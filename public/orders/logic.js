export const PIECE_HOURS = { 4: 10, 6: 15 };
export const TEN_INCH_DAYS = 4;
export const LEAD_DAYS = { 4: 3, 6: 3, 10: 7 };

const PRINT_CAP = 4;
const PAINT_CAP = 6;
let bench = { print: PRINT_CAP, paint: PAINT_CAP, printOff: new Set(), paintOff: new Set() };

function dateToken(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function useBench(settings = {}) {
  const printPoints = Number(settings.printPoints);
  const paintPoints = Number(settings.paintPoints);
  const shop = settings.closedShop || [];
  bench = {
    print: (Number.isFinite(printPoints) && printPoints > 0 ? printPoints : 2) * 2,
    paint: (Number.isFinite(paintPoints) && paintPoints > 0 ? paintPoints : 3) * 2,
    printOff: new Set([...(settings.closedPrint || []), ...shop]),
    paintOff: new Set([...(settings.closedPaint || []), ...shop]),
  };
}

function printOpen(date) {
  return !bench.printOff.has(dateToken(date));
}

function paintOpen(date) {
  return isPaintDay(date) && !bench.paintOff.has(dateToken(date));
}

export function hoursFor(size, qty, hoursPerDay) {
  const n = Number(qty) || 1;
  if (size === 10) return TEN_INCH_DAYS * hoursPerDay * n;
  return (PIECE_HOURS[size] || 0) * n;
}

export function parseSize(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("10")) return 10;
  if (text.includes("6")) return 6;
  if (text.includes("4")) return 4;
  const n = Number(text);
  return n === 10 || n === 6 || n === 4 ? n : null;
}

export function dayKey(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, days) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isWorkday(date, workdays) {
  return workdays.includes(date.getDay());
}

export function workingHoursBetween(from, to, hoursPerDay, workdays) {
  const end = dayKey(to);
  let hours = 0;
  for (let date = startOfDay(from); dayKey(date) <= end; date = addDays(date, 1)) {
    if (isWorkday(date, workdays)) hours += hoursPerDay;
  }
  return hours;
}

export function subtractDays(date, days) {
  return addDays(date, -Math.max(0, Number(days) || 0));
}

export function formatDay(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function skipped(status) {
  const text = String(status ?? "").trim().toLowerCase();
  return ["done", "shipped", "cancelled", "canceled", "complete", "completed"].includes(text);
}

function printCost(size) {
  if (size === 6) return 3;
  if (size === 10) return bench.print;
  return 2;
}

function paintCost(size) {
  if (size === 6) return 3;
  if (size === 10) return bench.paint;
  return 2;
}

function isPaintDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function nextPaintDayAfter(date) {
  let day = addDays(date, 1);
  for (let i = 0; i < 400 && !paintOpen(day); i += 1) day = addDays(day, 1);
  return day;
}

function lastPaintOnOrBefore(date) {
  let day = startOfDay(date);
  for (let i = 0; i < 21; i += 1) {
    if (paintOpen(day)) return day;
    day = addDays(day, -1);
  }
  return startOfDay(date);
}

function emptyLoads() {
  return { print: new Map(), paint: new Map() };
}

function cloneLoads(loads) {
  return { print: new Map(loads.print), paint: new Map(loads.paint) };
}

function used(map, date) {
  return map.get(dayKey(date)) || 0;
}

export const SHIP_DAYS_DEFAULT = 1;

export function painterOf(order) {
  if (order?.painter === "local" || order?.painter === "remote") return order.painter;
  return Number(order?.rushDays) > 0 ? "local" : "remote";
}

function shipDaysOf(settings) {
  const days = Number(settings?.shipDays);
  return Number.isFinite(days) && days >= 0 ? days : SHIP_DAYS_DEFAULT;
}

function routeOf(figure, settings) {
  return { painter: figure?.painter === "local" ? "local" : "remote", shipDays: shipDaysOf(settings) };
}

function earliestPaintDate(printEnd, painter, shipDays) {
  if (painter === "local") return nextPaintDayAfter(printEnd);
  const arrival = addDays(addDays(printEnd, 1), shipDays);
  return isPaintDay(arrival) ? arrival : nextPaintDayAfter(addDays(arrival, -1));
}

function paintDaysFrom(firstPaint, lastPaint) {
  const days = [];
  let day = paintOpen(firstPaint) ? startOfDay(firstPaint) : nextPaintDayAfter(addDays(firstPaint, -1));
  while (dayKey(day) <= dayKey(lastPaint) && days.length < 500) {
    days.push(day);
    day = nextPaintDayAfter(day);
  }
  return days;
}

function blockFree(loads, start) {
  for (let i = 0; i < TEN_INCH_DAYS; i += 1) {
    if (!printOpen(addDays(start, i)) || used(loads.print, addDays(start, i)) !== 0) return false;
  }
  return true;
}

function commit(size, slot, loads) {
  if (size === 10) {
    for (let i = 0; i < TEN_INCH_DAYS; i += 1) loads.print.set(dayKey(addDays(slot.print, i)), bench.print);
  } else {
    loads.print.set(dayKey(slot.print), used(loads.print, slot.print) + printCost(size));
  }
  loads.paint.set(dayKey(slot.paint), used(loads.paint, slot.paint) + paintCost(size));
}

function findSlot(size, loads, from, due, prefer, route = {}) {
  const painter = route.painter === "local" ? "local" : "remote";
  const transit = route.shipDays ?? SHIP_DAYS_DEFAULT;
  const lastPaint = lastPaintOnOrBefore(due);
  const firstPrint = startOfDay(from);
  if (dayKey(lastPaint) < dayKey(firstPrint)) return null;
  const pack = (print, paint, printEnd) => ({
    print,
    paint,
    ship: painter === "remote" ? addDays(printEnd, 1) : null,
    arrival: painter === "remote" ? addDays(addDays(printEnd, 1), transit) : null,
  });

  if (size === 10) {
    const starts = [];
    for (let start = firstPrint; starts.length < 500; start = addDays(start, 1)) {
      const end = addDays(start, TEN_INCH_DAYS - 1);
      if (dayKey(earliestPaintDate(end, painter, transit)) > dayKey(lastPaint)) break;
      if (blockFree(loads, start)) starts.push(start);
    }
    if (prefer === "latest") starts.reverse();
    for (const start of starts) {
      const end = addDays(start, TEN_INCH_DAYS - 1);
      const paints = paintDaysFrom(earliestPaintDate(end, painter, transit), lastPaint);
      if (prefer === "latest") paints.reverse();
      const paint = paints.find((day) => used(loads.paint, day) + paintCost(10) <= bench.paint);
      if (paint) return pack(start, paint, end);
    }
    return null;
  }

  let lastPrint = addDays(lastPaint, -1);
  while (dayKey(lastPrint) >= dayKey(firstPrint) && dayKey(earliestPaintDate(lastPrint, painter, transit)) > dayKey(lastPaint)) {
    lastPrint = addDays(lastPrint, -1);
  }
  if (dayKey(lastPrint) < dayKey(firstPrint)) return null;
  const prints = [];
  for (let day = firstPrint; dayKey(day) <= dayKey(lastPrint); day = addDays(day, 1)) prints.push(day);
  if (prefer === "latest") prints.reverse();
  for (const print of prints) {
    if (!printOpen(print) || used(loads.print, print) + printCost(size) > bench.print) continue;
    const paints = paintDaysFrom(earliestPaintDate(print, painter, transit), lastPaint);
    if (prefer === "latest") paints.reverse();
    const paint = paints.find((day) => used(loads.paint, day) + paintCost(size) <= bench.paint);
    if (paint) return pack(print, paint, print);
  }
  return null;
}

function parseStamp(value) {
  if (!value) return null;
  const [date] = String(value).split("T");
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function occupyPrint(loads, day, size) {
  if (!day) return;
  if (size === 10) loads.print.set(dayKey(day), bench.print);
  else loads.print.set(dayKey(day), Math.min(bench.print, used(loads.print, day) + printCost(size)));
}

function occupyPaint(loads, day, size) {
  if (!day || !isPaintDay(day)) return;
  loads.paint.set(dayKey(day), Math.min(bench.paint, used(loads.paint, day) + paintCost(size)));
}

function findPaintDay(size, loads, from, until) {
  let day = paintOpen(from) ? startOfDay(from) : nextPaintDayAfter(addDays(from, -1));
  while (dayKey(day) <= dayKey(until)) {
    if (used(loads.paint, day) + paintCost(size) <= bench.paint) return day;
    day = nextPaintDayAfter(day);
  }
  return null;
}

function printSpanDays(figure) {
  const start = parseStamp(figure.printStarted);
  const finished = parseStamp(figure.printFinished);
  if (!start) return [];
  const end = figure.size === 10 ? addDays(start, TEN_INCH_DAYS - 1) : start;
  const last = finished && dayKey(finished) > dayKey(end) ? finished : end;
  const days = [];
  for (let day = startOfDay(start); dayKey(day) <= dayKey(last); day = addDays(day, 1)) days.push(day);
  return days;
}

function reservePaint(figure, loads, from) {
  const paint = findPaintDay(figure.size, loads, from, addDays(from, 120));
  if (paint) occupyPaint(loads, paint, figure.size);
  return paint;
}

function pinStage(figure, loads, today, settings) {
  const stage = figure.stage || "Pending";
  const printDays = printSpanDays(figure);
  const stampPrint = () => {
    for (const day of printDays) occupyPrint(loads, day, figure.size);
  };
  const transit = shipDaysOf(settings);
  const remote = figure.painter !== "local";
  const afterPrint = (printEnd) => {
    const paint = reservePaint(figure, loads, earliestPaintDate(printEnd, remote ? "remote" : "local", transit));
    const ship = remote ? addDays(printEnd, 1) : null;
    return { paint, ship, arrival: ship ? addDays(ship, transit) : null };
  };
  if (stage === "Completed" || stage === "On Hold" || stage === "Cancelled") {
    stampPrint();
    const painted = parseStamp(figure.paintFinished) || parseStamp(figure.paintStarted);
    if (painted) occupyPaint(loads, painted, figure.size);
    return { print: printDays[0] || null, printDays, paint: painted, finish: painted, ship: parseStamp(figure.shipOut), arrival: parseStamp(figure.actualArrival) || parseStamp(figure.expectedArrival) };
  }
  if (stage === "Printing") {
    const start = parseStamp(figure.printStarted) || today;
    let last = figure.size === 10 ? addDays(start, TEN_INCH_DAYS - 1) : start;
    if (dayKey(today) > dayKey(last)) last = today;
    const live = [];
    for (let day = startOfDay(start); dayKey(day) <= dayKey(last); day = addDays(day, 1)) {
      occupyPrint(loads, day, figure.size);
      live.push(day);
    }
    const planned = afterPrint(last);
    return { print: start, printDays: live, ...planned, finish: planned.paint };
  }
  if (stage === "Ready for Ship-out") {
    stampPrint();
    const finished = parseStamp(figure.printFinished) || addDays(today, -1);
    const ship = dayKey(addDays(finished, 1)) < dayKey(today) ? today : addDays(finished, 1);
    const arrival = addDays(ship, transit);
    const paintFrom = isPaintDay(arrival) ? arrival : nextPaintDayAfter(addDays(arrival, -1));
    const paint = reservePaint(figure, loads, dayKey(paintFrom) < dayKey(today) ? today : paintFrom);
    return { print: printDays[0] || null, printDays, ship, arrival, paint, finish: paint };
  }
  if (stage === "Shipped") {
    stampPrint();
    const ship = parseStamp(figure.shipOut) || today;
    const arrival = parseStamp(figure.expectedArrival) || addDays(ship, transit);
    const paintFrom = dayKey(arrival) < dayKey(today) ? today : arrival;
    const paint = reservePaint(figure, loads, isPaintDay(paintFrom) ? paintFrom : nextPaintDayAfter(addDays(paintFrom, -1)));
    return { print: printDays[0] || null, printDays, ship, arrival, paint, finish: paint };
  }
  if (stage === "Received" || stage === "Ready for Painting") {
    stampPrint();
    const arrived = parseStamp(figure.actualArrival);
    const finished = parseStamp(figure.printFinished) || addDays(today, -1);
    const paintFrom = arrived
      ? (dayKey(arrived) < dayKey(today) ? today : arrived)
      : (dayKey(nextPaintDayAfter(finished)) < dayKey(today) && isPaintDay(today) ? today : nextPaintDayAfter(finished));
    const paint = reservePaint(figure, loads, isPaintDay(paintFrom) ? paintFrom : nextPaintDayAfter(addDays(paintFrom, -1)));
    return { print: printDays[0] || null, printDays, ship: parseStamp(figure.shipOut), arrival: arrived, paint, finish: paint };
  }
  if (stage === "Painting") {
    stampPrint();
    const started = parseStamp(figure.paintStarted) || today;
    occupyPaint(loads, started, figure.size);
    if (dayKey(started) < dayKey(today)) occupyPaint(loads, today, figure.size);
    const finish = dayKey(started) < dayKey(today) ? today : started;
    return { print: printDays[0] || null, printDays, ship: parseStamp(figure.shipOut), arrival: parseStamp(figure.actualArrival) || parseStamp(figure.expectedArrival), paint: finish, finish };
  }
  return { print: null, printDays, paint: null, finish: null, ship: null, arrival: null };
}

function expandFigures(orders, today) {
  const figures = [];
  for (const order of orders) {
    const qty = Number(order.qty) || 1;
    const size = order.size || 4;
    const promised = order.due ? startOfDay(order.due) : null;
    const stored = Array.isArray(order.figures) ? order.figures : [];
    for (let piece = 0; piece < qty; piece += 1) {
      const source = stored[piece] || {};
      const stage = source.stage || (skipped(order.status) ? "Completed" : "Pending");
      if (stage === "Pending" && !promised) continue;
      if (stage === "Cancelled" || stage === "On Hold") continue;
      figures.push({
        id: `${order.id}:${piece}`,
        orderId: order.id,
        name: order.name || "Order",
        size,
        qty,
        promised,
        stage,
        late: Boolean(promised) && stage === "Pending" && dayKey(promised) < dayKey(today),
        locked: stage !== "Pending",
        painter: painterOf(order),
        printStarted: source.printStarted || "",
        printFinished: source.printFinished || "",
        shipOut: source.shipOut || "",
        expectedArrival: source.expectedArrival || "",
        actualArrival: source.actualArrival || "",
        paintStarted: source.paintStarted || "",
        paintFinished: source.paintFinished || "",
      });
    }
  }
  return figures;
}

function placedFrom(figure, slot) {
  const finish = slot ? slot.paint : null;
  const printDays = slot ? (figure.size === 10 ? [0, 1, 2, 3].map((offset) => addDays(slot.print, offset)) : [slot.print]) : [];
  return {
    ...figure,
    print: slot ? slot.print : null,
    printDays,
    ship: slot ? slot.ship : null,
    arrival: slot ? slot.arrival : null,
    paint: finish,
    finish,
    ok: Boolean(finish) && !figure.late && (!figure.promised || dayKey(finish) <= dayKey(figure.promised)),
  };
}

function placeAll(figures, loads, today, prefer, settings) {
  const placed = [];
  for (const figure of figures) {
    const due = figure.late ? addDays(today, 500) : figure.promised;
    const slot = findSlot(figure.size, loads, today, due, prefer, routeOf(figure, settings));
    if (slot) commit(figure.size, slot, loads);
    placed.push(placedFrom(figure, slot));
  }
  return placed;
}

export function optimizeProductionSchedule(orders, settings) {
  useBench(settings);
  const today = startOfDay(settings.today);
  const figures = expandFigures(orders, today);
  const loads = emptyLoads();
  const pinned = [];
  for (const figure of figures.filter((item) => item.stage !== "Pending")) {
    const slot = pinStage(figure, loads, today, settings);
    const finish = slot.finish;
    pinned.push({
      ...figure,
      ...slot,
      locked: true,
      ok: figure.stage === "Completed" || !figure.promised || (Boolean(finish) && dayKey(finish) <= dayKey(figure.promised)),
    });
  }
  const pending = figures.filter((item) => item.stage === "Pending");
  const late = pending.filter((item) => item.late);
  const flexible = pending
    .filter((item) => !item.late)
    .sort((a, b) => dayKey(a.promised) - dayKey(b.promised) || a.qty - b.qty);
  const placedLate = placeAll(late, loads, today, "asap", settings);
  const placedFlex = [];
  for (const figure of flexible) {
    const route = routeOf(figure, settings);
    const latest = findSlot(figure.size, loads, today, figure.promised, "latest", route);
    const slot = latest || findSlot(figure.size, loads, today, figure.promised, "asap", route);
    if (slot) commit(figure.size, slot, loads);
    placedFlex.push(placedFrom(figure, slot));
  }
  return { today, loads, placed: [...pinned, ...placedLate, ...placedFlex] };
}

function groupOrders(placed) {
  const groups = new Map();
  for (const figure of placed) {
    const group = groups.get(figure.orderId) || [];
    group.push(figure);
    groups.set(figure.orderId, group);
  }
  return [...groups.entries()].map(([id, pieces]) => {
    const finishes = pieces.map((piece) => piece.finish);
    const finish = finishes.every(Boolean) ? finishes.sort((a, b) => dayKey(a) - dayKey(b)).at(-1) : null;
    return {
      id,
      size: pieces[0].size,
      qty: pieces.length,
      promised: pieces[0].promised,
      finish,
      ok: pieces.every((piece) => piece.ok),
      late: pieces[0].late,
      stage: pieces.map((piece) => piece.stage || "Pending").join("/"),
    };
  });
}

export function schedule(orders, settings) {
  return groupOrders(optimizeProductionSchedule(orders, settings).placed);
}

function candidateFigures(candidate, promised) {
  const qty = Number(candidate.qty) || 1;
  return Array.from({ length: qty }, (_, piece) => ({
    id: `candidate:${piece}`,
    orderId: "candidate",
    size: candidate.size,
    qty,
    promised,
    late: false,
    locked: false,
    painter: candidate.painter || (Number(candidate.rushDays) > 0 ? "local" : "remote"),
    stage: "Pending",
  }));
}

function finishesInTime(placed) {
  return placed.every((figure) => figure.finish && dayKey(figure.finish) <= dayKey(figure.promised));
}

export function simulateNewOrder(existing, candidate, settings) {
  useBench(settings);
  const today = startOfDay(settings.today);
  const promised = startOfDay(candidate.deadline);
  const rush = Math.min(LEAD_DAYS[candidate.size] ?? 3, Math.max(0, Number(candidate.rushDays) || 0));
  const earliestLead = addDays(today, (LEAD_DAYS[candidate.size] ?? 3) - rush);
  if (dayKey(promised) < dayKey(earliestLead)) {
    return { ok: false, promised, finish: null, reason: "lead" };
  }

  const baseline = optimizeProductionSchedule(existing, settings);
  const pinnedLoads = emptyLoads();
  const todayPinned = startOfDay(settings.today);
  for (const figure of expandFigures(existing, todayPinned).filter((item) => item.stage !== "Pending" || item.late)) {
    if (figure.stage === "Pending") continue;
    pinStage(figure, pinnedLoads, todayPinned);
  }
  const latePending = expandFigures(existing, todayPinned).filter((item) => item.stage === "Pending" && item.late);
  placeAll(latePending, pinnedLoads, todayPinned, "asap", settings);
  const flexible = baseline.placed.filter((figure) => figure.stage === "Pending" && !figure.late && !figure.locked);
  const newcomers = candidateFigures(candidate, promised);
  const loads = cloneLoads(pinnedLoads);
  let finish = null;
  let gapFit = true;
  for (const figure of newcomers) {
    const slot = findSlot(figure.size, loads, today, promised, "asap", routeOf(figure, settings)) || findSlot(figure.size, loads, today, promised, "latest", routeOf(figure, settings));
    if (!slot) {
      gapFit = false;
      break;
    }
    commit(figure.size, slot, loads);
    finish = slot.paint;
  }
  if (gapFit) return { ok: true, promised, finish, reason: "gap" };

  const pool = [...flexible, ...newcomers].sort((a, b) => dayKey(a.promised) - dayKey(b.promised));
  for (const prefer of ["asap", "latest"]) {
    const trial = cloneLoads(pinnedLoads);
    const moved = [];
    let possible = true;
    for (const figure of pool) {
      const slot = findSlot(figure.size, trial, today, figure.promised, prefer, routeOf(figure, settings));
      if (!slot) {
        possible = false;
        break;
      }
      commit(figure.size, slot, trial);
      moved.push({ ...figure, finish: slot.paint });
    }
    if (possible && finishesInTime(moved)) {
      const mine = moved.filter((figure) => figure.orderId === "candidate");
      return { ok: true, promised, finish: mine.map((figure) => figure.finish).sort((a, b) => dayKey(a) - dayKey(b)).at(-1), reason: "moved" };
    }
  }
  return { ok: false, promised, finish: null, reason: "full" };
}

export function acceptOrder(existing, candidate, settings) {
  const result = simulateNewOrder(existing, candidate, settings);
  return {
    ok: result.ok,
    hours: hoursFor(candidate.size, candidate.qty, settings.hoursPerDay),
    promised: result.promised,
    finish: result.finish,
    reason: result.reason,
    queue: schedule(existing, settings),
  };
}

export function checkDateAvailability(existing, size, date, settings) {
  return acceptOrder(existing, { size, qty: 1, deadline: date, rushDays: 0 }, settings);
}

export function findEarliestAvailableDate(existing, candidate, settings) {
  const rush = Math.min(LEAD_DAYS[candidate.size] ?? 3, Math.max(0, Number(candidate.rushDays) || 0));
  let date = addDays(startOfDay(settings.today), (LEAD_DAYS[candidate.size] ?? 3) - rush);
  for (let i = 0; i < 400; i += 1) {
    if (simulateNewOrder(existing, { ...candidate, deadline: date, rushDays: rush }, settings).ok) return date;
    date = addDays(date, 1);
  }
  return null;
}

export function earliestDate(existing, candidate, settings) {
  return findEarliestAvailableDate(existing, candidate, settings);
}

export function dayActivity(orders, settings, date) {
  const plan = optimizeProductionSchedule(orders, settings);
  const key = dayKey(startOfDay(date));
  const printing = [];
  const painting = [];
  for (const figure of plan.placed) {
    if ((figure.printDays || []).some((day) => dayKey(day) === key)) printing.push(figure);
    if (figure.paint && dayKey(figure.paint) === key) painting.push(figure);
  }
  return {
    printing,
    painting,
    printUsed: used(plan.loads.print, date) / 2,
    paintUsed: paintOpen(date) ? used(plan.loads.paint, date) / 2 : null,
    printCap: bench.print / 2,
    paintCap: paintOpen(date) ? bench.paint / 2 : 0,
  };
}
