// SPIKE E1 renderer — engångskod. Spacer-baserad virtualisering (samma modell som
// @tanstack/virtual skulle ge: total höjd + absolut placerade synliga block).
//
// Sidblock renderas som en tom "slot"; det riktiga live-innehållet är en native
// WebContentsView som main-processen positionerar mot slotens skärm-rect via IPC.

const GAP = 14;
const MARGIN_SCREENS = 1; // förhämtningsmarginal ≈ 1 skärmhöjd (F-LAZY-3 default)

// data:-URL:er så spiken funkar UTAN nätverk. Byt mot riktiga https-URL:er lokalt.
const liveColors = ["#c0392b", "#2d7d46", "#2f5fbf", "#8250df", "#b8860b"];
function livePage(i, title) {
  const c = liveColors[i % liveColors.length];
  const html =
    `<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;` +
    `font:600 24px system-ui;color:#fff;background:${c}">` +
    `LIVE WEBVIEW #${i}<br>${title}</body>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

// Bygg ~28 block med FASTA höjder (12.4-beslutet gör höjdreservationen trivial).
const HEIGHTS = { small: 240, medium: 480, large: 720 };
const blocks = [];
let pageCounter = 0;
for (let i = 0; i < 28; i++) {
  const isPage = i % 3 === 1; // ung. var tredje är ett sidblock
  if (isPage) {
    const n = ++pageCounter;
    const h = [HEIGHTS.small, HEIGHTS.medium, HEIGHTS.large][n % 3];
    blocks.push({
      id: `blk_p${n}`,
      type: "page",
      title: `Sidblock ${n}`,
      url: livePage(n, `Sidblock ${n}`),
      height: h,
    });
  } else {
    blocks.push({
      id: `blk_t${i}`,
      type: "text",
      title: `Textblock ${i}`,
      body: "Beskrivande anteckning. Scrolla — sidblocken ska följa med, taket är 3 live-vyer.",
      height: 160,
    });
  }
}

// Kumulativa offsets + total höjd.
const offsets = [];
let total = 0;
for (const b of blocks) {
  offsets.push(total);
  total += b.height + GAP;
}

const scroller = document.getElementById("scroller");
const content = document.getElementById("content");
const hud = document.getElementById("hud");
content.style.height = total + "px";

const mounted = new Map(); // blockId -> element

function visibleRange() {
  const vh = scroller.clientHeight;
  const margin = vh * MARGIN_SCREENS;
  const top = scroller.scrollTop - margin;
  const bottom = scroller.scrollTop + vh + margin;
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const y = offsets[i];
    if (y + blocks[i].height >= top && y <= bottom) out.push(i);
  }
  return out;
}

function elFor(b, y) {
  let el = mounted.get(b.id);
  if (el) return el;
  el = document.createElement("div");
  el.className = "block " + (b.type === "page" ? "page-block" : "text-block");
  el.style.top = y + "px";
  el.style.height = b.height + "px";
  if (b.type === "text") {
    el.innerHTML = `<div class="inner"><h2>${b.title}</h2><p>${b.body}</p></div>`;
  } else {
    el.innerHTML =
      `<div class="inner">` +
      `<div class="page-head"><span class="dot"></span>${b.title} — ${b.id}</div>` +
      `<div class="webview-slot"><div class="slot-hint">native WebContentsView förväntas här</div>` +
      `<div class="block-toolbar">⚙ VERKTYGSRAD (ska ligga överst)</div></div>` +
      `</div>`;
  }
  content.appendChild(el);
  mounted.set(b.id, el);
  return el;
}

let pending = false;
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(render);
}

async function render() {
  pending = false;
  const range = visibleRange();
  const keep = new Set(range.map((i) => blocks[i].id));

  // Avmontera DOM för block utanför fönstret (virtualisering).
  for (const [id, el] of mounted) {
    if (!keep.has(id)) {
      el.remove();
      mounted.delete(id);
    }
  }

  // Montera/uppdatera synliga block.
  const visiblePages = [];
  for (const i of range) {
    const b = blocks[i];
    elFor(b, offsets[i]);
    if (b.type === "page") visiblePages.push(b);
  }

  // Mät varje sidblocks slot-rect (skärmkoordinater = fönstrets contentView).
  const visible = visiblePages.map((b) => {
    const el = mounted.get(b.id);
    const slot = el.querySelector(".webview-slot");
    const r = slot.getBoundingClientRect();
    return {
      blockId: b.id,
      url: b.url,
      bounds: { x: r.left, y: r.top, width: r.width, height: r.height },
    };
  });

  try {
    const res = await window.spike.sync({ visible, winHeight: window.innerHeight });
    hud.innerHTML = `live: <b>${res.liveCount}</b> / tak 3 · processer: <b>${res.processCount}</b>`;
  } catch (e) {
    hud.textContent = "IPC-fel: " + e.message;
  }
}

scroller.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", schedule);
schedule();
