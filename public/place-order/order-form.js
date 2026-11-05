const SIZES = [
  { id: '2.5', value: 'Mini 2.5"', name: '2.5-inch', price: 899, image: '/images/figure-classic.jpg' },
  { id: '4', value: 'Standard 4"', name: '4-inch', price: 1599, image: '/images/figure-classic.jpg' },
  { id: '6', value: 'Super 6"', name: '6-inch', price: 3099, image: '/images/figure-super.jpg' },
  { id: '10', value: 'Jumbo 10"', name: '10-inch', price: 6499, image: '/images/figure-jumbo.jpg' },
];
const COLORS = [
  { name: 'Plum', image: 'plum' }, { name: 'Blush Pink', image: 'blush' },
  { name: 'Sunset Orange', image: 'sunset' }, { name: 'Midnight Black', image: 'midnight' },
  { name: 'Royal Blue', image: 'royal' }, { name: 'Burgundy', image: 'burgundy' },
];
const CUSTOM = 'Custom - Build it with us';
const CUSTOM_FEE = 100;
const PAYMENT_QR = '00020101021127580012com.p2pqrpay0111LAUIPHM2XXX0208999644030411110161057295204601653036085802PH5915KYLA TRISHIA E.6009Pagsanjan630452E1';
const QR_POINT_OF_INITIATION = '12';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const peso = value => '₱' + Number(value).toLocaleString('en-PH', {maximumFractionDigits:2});
const state = { lines: [{ size:null, color:null, boxName:'' }] };
const openedAt = Date.now();
let checkout = null;
const SESSION_KEY = 'hax-checkout-v2';
const sizeOf = line => SIZES.find(size => size.id === line.size);
const lineTotal = line => sizeOf(line) ? sizeOf(line).price + (line.color === CUSTOM ? CUSTOM_FEE : 0) : 0;
const optionalFee = id => Number.isFinite(Number($(id).value)) ? Math.max(0, Number($(id).value)) : 0;
const row = (label, value, css='') => `<dt class="${css}">${escapeHtml(label)}</dt><dd class="${css}">${escapeHtml(value)}</dd>`;
function renderLines() {
  $('lines').innerHTML = state.lines.map((line, index) => `
    <div class="line" data-i="${index}">
      <div class="line-head"><strong>Figure ${index+1}</strong>${state.lines.length>1 ? `<button class="remove" type="button" data-remove="${index}">Remove</button>` : ''}</div>
      <h3>Size</h3>
      <div class="cards">${SIZES.map(size => `<label class="card"><input type="radio" name="size-${index}" value="${size.id}" ${line.size===size.id?'checked':''} /><img src="${size.image}" alt="" /><strong>${size.name}</strong><span class="price">${peso(size.price)}</span></label>`).join('')}</div>
      <h3>Box color</h3>
      <div class="swatches">${COLORS.map(color => `<label class="swatch"><input type="radio" name="color-${index}" value="${color.name}" ${line.color===color.name?'checked':''} /><img src="/place-order/boxes/${color.image}.jpg" alt="${color.name} box" loading="lazy" /><span>${color.name}</span></label>`).join('')}
        <label class="swatch custom"><input type="radio" name="color-${index}" value="${CUSTOM}" ${line.color===CUSTOM?'checked':''} /><span class="dot" aria-hidden="true"></span><strong>Custom Color</strong><span>Build it with us. +${peso(CUSTOM_FEE)}</span></label>
      </div>
      <label class="field box-name">Name on the box <small>(max 13 characters)</small><input type="text" data-boxname="${index}" maxlength="13" value="${escapeHtml(line.boxName)}" autocomplete="off" required /></label>
    </div>`).join('');
  $('addLine').hidden = state.lines.length >= 8;
}
function refresh() {
  const accessories = optionalFee('accessoryFee'), rush = optionalFee('rushFee');
  const total = state.lines.reduce((sum,line)=>sum+lineTotal(line),0) + accessories + rush;
  const now = Math.round(Math.round(total*100)/2)/100;
  $('sumDl').innerHTML = state.lines.map((line,index)=>row(`Figure ${index+1}: 1× ${sizeOf(line)?.name || ''}`, sizeOf(line) ? peso(lineTotal(line)) : '—')).join('')
    + row('Accessory Fee', $('accessoryFee').value.trim() ? peso(accessories) : '—')
    + row('Rush Fee', $('rushFee').value.trim() ? peso(rush) : '—')
    + row('Order Total', total ? peso(total) : '—','order-total')
    + row('Paying Now',total ? peso(now) : '—') + row('Balance Later',total ? peso(Math.round((total-now)*100)/100) : '—');
}
document.addEventListener('change', event => {
  const target = event.target;
  if (target.name?.startsWith('size-')) state.lines[Number(target.name.slice(5))].size = target.value;
  if (target.name?.startsWith('color-')) state.lines[Number(target.name.slice(6))].color = target.value;
  refresh();
});
document.addEventListener('input', event => {
  const target = event.target;
  if (target.dataset.boxname !== undefined) state.lines[Number(target.dataset.boxname)].boxName = target.value.slice(0,13);
  refresh();
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  state.lines.splice(Number(button.dataset.remove),1); renderLines(); refresh();
});
$('addLine').onclick = () => {
  if (state.lines.length>=8) return;
  state.lines.push({size:null,color:null,boxName:''}); renderLines(); refresh();
  $('lines').lastElementChild.scrollIntoView({behavior:'smooth',block:'start'});
};
function fail(message, field) {
  $('err').textContent = message;
  if (field) field.focus();
}
$('order').addEventListener('submit', async event => {
  event.preventDefault(); fail('');
  if (!$('facebookName').value.trim()) return fail('Please enter your Facebook name.', $('facebookName'));
  for (let i=0;i<state.lines.length;i++) {
    const line=state.lines[i];
    if (!sizeOf(line)) return fail(`Figure ${i+1}: please choose a size.`);
    if (!line.color) return fail(`Figure ${i+1}: please choose a box color.`);
    if (!line.boxName.trim()) return fail(`Figure ${i+1}: please enter the name on the box.`,document.querySelector(`[data-boxname="${i}"]`));
  }
  for (const [id,label] of [['accessoryFee','accessory fee'],['rushFee','rush fee']]) {
    if (!$(id).value.trim()) return fail(`Enter the ${label}. Type 0 if there is none.`,$(id));
    if (!$(id).checkValidity()) return fail(`Please enter a valid ${label}, using 0 if there is none.`,$(id));
  }
  if (!$('agreement').checked) return fail('Please read and accept the order agreement.',$('agreement'));
  $('submit').disabled=true; $('submit').textContent='Placing order…';
  try {
    const response=await fetch('/api/order-intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      facebookName:$('facebookName').value.trim(), agreementAccepted:true, accessoryFee:$('accessoryFee').value, rushFee:$('rushFee').value,
      items:state.lines.map(line=>({size:sizeOf(line).value,color:line.color,boxName:line.boxName.trim(),qty:1})),
      website:$('website').value,seconds:Math.round((Date.now()-openedAt)/1000),
    })});
    const data=await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save your order. Please try again.');
    checkout=data; saveSession(); showPayment();
  } catch(error) { fail(error.message || 'Could not save your order. Please try again.'); }
  finally { $('submit').disabled=false; $('submit').textContent='Place Order'; }
});
function saveSession() { try {sessionStorage.setItem(SESSION_KEY,JSON.stringify(checkout));} catch {} }
      function crc16(text) {
        let c = 0xffff;
        for (const b of new TextEncoder().encode(text)) {
          c ^= b << 8;
          for (let i = 0; i < 8; i += 1) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
        }
        return c.toString(16).toUpperCase().padStart(4, "0");
      }
      function qrWithAmount(amount) {
        const a = Number(amount).toFixed(2);
        let body = PAYMENT_QR.slice(0, -8); // drop the old "6304XXXX" checksum
        body = body.replace("010211", "0102" + QR_POINT_OF_INITIATION).replace("5303608", "5303608" + "54" + String(a.length).padStart(2, "0") + a);
        body += "6304";
        return body + crc16(body);
      }
      function qrPng(text) {
        const q = qrcode(0, "M");
        q.addData(text);
        q.make();
        const n = q.getModuleCount(), px = 8, quiet = 4, size = (n + quiet * 2) * px;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const g = canvas.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, size, size);
        g.fillStyle = "#000";
        for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (q.isDark(r, c)) g.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
        return canvas.toDataURL("image/png");
      }

function showPayment() {
  $('formView').hidden=true; $('done').hidden=false;
  $('dRef').textContent='ORDER #'+checkout.ref;
  $('trackingNumber').textContent=checkout.ref;
  $('trackOrder').href='/track-order/?ref='+encodeURIComponent(checkout.ref);
  $('dSummary').innerHTML=checkout.items.map((item,index)=>row(`Figure ${index+1}`,`1× ${item.size} · ${item.color} · “${item.boxName}” — ${peso(item.price)}`)).join('')
    +row('Accessory Fee',peso(checkout.accessoryFee))+row('Rush Fee',peso(checkout.rushFee))
    +row('Order Total',peso(checkout.total),'order-total')+row('Paying Now',peso(checkout.payNow))
    +row('Balance Later',peso(Math.round((checkout.total-checkout.payNow)*100)/100))
    +row('Current Lead Time','15–20 days')+row('Order Agreement','Accepted');
  const png=qrPng(qrWithAmount(checkout.payNow));
  $('paymentQr').src=png; $('paymentQr').alt='Payment QR for '+peso(checkout.payNow);
  $('scanTitle').textContent='Scan to Pay '+peso(checkout.payNow);
  $('saveQr').href=png; $('saveQr').download=`haxworks-${checkout.ref}.png`;
  $('reportPaid').textContent=checkout.paymentReported?'PAID':'Pay';
  $('reportPaid').classList.toggle('paid',Boolean(checkout.paymentReported));
  $('reportPaid').disabled=Boolean(checkout.paymentReported);
  window.scrollTo({top:0,behavior:'instant'});
}
async function copyText(text,button) {
  try {
    await navigator.clipboard.writeText(text); button.textContent='Copied!';
    $('copyStatus').textContent='Copied to clipboard.';
    setTimeout(()=>{button.textContent=button.id==='copyOrder'?'▢  Copy':'Copy';},2000);
  } catch { $('copyStatus').textContent="Couldn't copy automatically. Please select and copy the detail."; }
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-copy]');
  if(button) copyText(button.dataset.copy,button);
});
$('copyOrder').onclick=()=>copyText(checkout.ref,$('copyOrder'));
$('reportPaid').onclick=async()=>{
  $('reportPaid').disabled=true; $('reportPaid').textContent='Saving…'; $('paymentError').textContent='';
  try {
    const response=await fetch('/api/order-payment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ref:checkout.ref,token:checkout.paymentToken})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Please try again.');
    checkout.paymentReported=true; saveSession();
    $('reportPaid').textContent='PAID'; $('reportPaid').classList.add('paid');
    setTimeout(()=>location.assign($('trackOrder').href),1000);
  } catch(error) {
    $('paymentError').textContent=error.message||"Couldn't save your payment update. Please try again.";
    $('reportPaid').disabled=false; $('reportPaid').textContent='Pay';
  }
};
$('startAgain').onclick=()=>{
  try{sessionStorage.removeItem(SESSION_KEY);}catch{}
  location.reload();
};
renderLines(); refresh();
try {
  const saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
  if(saved && /^[A-F0-9]{12}$/.test(saved.ref) && Array.isArray(saved.items) && saved.paymentToken) {checkout=saved;showPayment();}
} catch {}
