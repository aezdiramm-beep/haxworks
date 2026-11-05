export const FIGURE_PRICES: Record<string, number> = { 'Mini 2.5"': 899, 'Standard 4"': 1599, 'Super 6"': 3099, 'Jumbo 10"': 6499 };
export const CUSTOM_COLOR = "Custom - Build it with us";
export const CUSTOM_COLOR_FEE = 100;
const COLORS = ["Plum", "Blush Pink", "Sunset Orange", "Midnight Black", "Royal Blue", "Burgundy", CUSTOM_COLOR];

function fee(value: unknown, label: string) {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") throw new Error(`Enter the ${label}. Type 0 if there is none.`);
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) throw new Error(`Enter a valid ${label} (0 or more, up to two decimal places).`);
  return Math.round(amount * 100) / 100;
}

export function calculateCheckout(body: Record<string, unknown>) {
  const accessoryFee = fee(body.accessoryFee, "accessory fee");
  const rushFee = fee(body.rushFee, "rush fee");
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 8) throw new Error("Please add 1 to 8 figures.");
  const items = body.items.map((raw: Record<string, unknown>) => {
    const size = String(raw?.size || "");
    const color = String(raw?.color || "");
    const boxName = String(raw?.boxName || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 13);
    if (!Object.hasOwn(FIGURE_PRICES, size)) throw new Error("Please choose a size for every figure.");
    if (!COLORS.includes(color)) throw new Error("Please choose a box color for every figure.");
    if (!boxName) throw new Error("Please enter the name for every box.");
    if (raw.qty != null && raw.qty !== 1) throw new Error("Add each figure separately using Add another figure.");
    return { size, color, boxName, qty: 1, price: FIGURE_PRICES[size] + (color === CUSTOM_COLOR ? CUSTOM_COLOR_FEE : 0) };
  });
  const totalCents = items.reduce((sum, item) => sum + item.price * 100, 0) + Math.round(accessoryFee * 100) + Math.round(rushFee * 100);
  if (totalCents > 20000000) throw new Error("Please message us to confirm orders over ₱200,000.");
  const total = totalCents / 100;
  const payNow = Math.round(totalCents / 2) / 100;
  return { items, accessoryFee, rushFee, total, payNow };
}
