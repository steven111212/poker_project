// ---------- hand replayer (N8-style table view) ----------
const rpModal = document.getElementById("replayModal");
const SUITS = { s: "♠", h: "♥", d: "♦", c: "♣" };
const KIND_ZH = { fold: "棄牌", check: "過牌", call: "跟注", bet: "下注",
                  raise: "加注", post_sb: "小盲", post_bb: "大盲" };
const RING = ["SB", "BB", "UTG", "HJ", "CO", "BTN"];   // physical seat order
const SEAT_XY = [[50, 88], [14, 70], [14, 26], [50, 8], [86, 26], [86, 70]];

const pcard = c => c
  ? `<span class="pcard${"hd".includes(c[1]) ? " red" : ""}">` +
    `${c[0] === "T" ? "10" : c[0]}${SUITS[c[1]]}</span>`
  : "";
const cardBack = `<span class="pcard back"></span>`;

// display unit: "$" or big blinds, switchable inside the modal
let rpUnit = loadJSON(UI_KEY, {}).unit || "usd";
let rpBB = 0.1, rpOpenId = null;
const money = v => rpUnit === "bb"
  ? (Math.round(v / rpBB * 10) / 10) + " bb"
  : "$" + (Math.round(v * 100) / 100);

function rpSeats(rec, rp) {
  const present = RING.filter(p => rp.stk[p] !== undefined);
  const hi = Math.max(0, present.indexOf(rec.pos));
  const order = present.slice(hi).concat(present.slice(0, hi));
  return order.map((p, i) => {
    const [x, y] = SEAT_XY[i] || [50, 50];
    const isHero = p === rec.pos;
    const cards = isHero ? rp.hc.map(pcard).join("") :
                  rp.sh[p] ? rp.sh[p].map(pcard).join("") :
                  cardBack + cardBack;
    return `<div class="seat${isHero ? " hero" : ""}" style="left:${x}%;top:${y}%;">
      <div>${cards}</div>
      <div class="tag">${p}${p === "BTN" ? ` <span class="dbtn">D</span>` : ""}</div>
      <div class="stk">${money(rp.stk[p])}</div></div>`;
  }).join("");
}

function rpStreets(rec, rp) {
  const cols = [
    ["盲注", a => a[0] === "p" && a[2].startsWith("post"),
      money(rec.bb * 1.5)],
    ["翻牌前", a => a[0] === "p" && !a[2].startsWith("post"), null],
    ["翻牌", a => a[0] === "f", rp.pots[0] != null ? money(rp.pots[0]) : null],
    ["轉牌", a => a[0] === "t", rp.pots[1] != null ? money(rp.pots[1]) : null],
    ["河牌", a => a[0] === "r", rp.pots[2] != null ? money(rp.pots[2]) : null],
  ];
  return cols.map(([title, filt, potLbl]) => {
    const acts = rp.a.filter(filt);
    if (!acts.length && title !== "翻牌前") return "";
    const rows = acts.map(([, p, kind, amt]) =>
      `<div class="ract${p === rec.pos ? " hero" : ""}"><b>${p}</b> ` +
      `${KIND_ZH[kind] || kind}${amt ? " " + money(amt) : ""}</div>`).join("");
    return `<div class="rp-col"><h4>${title}` +
      `${potLbl ? `<span class="note" style="float:right;">${potLbl}</span>` : ""}` +
      `</h4>${rows || `<div class="ract note">—</div>`}</div>`;
  }).join("");
}

function openReplay(id) {
  const rec = loadStore().hands[id];
  if (!rec || !rec.rp) return;
  const rp = rec.rp;
  rpBB = rec.bb; rpOpenId = id;
  document.querySelectorAll("#rpUnit button").forEach(b =>
    b.classList.toggle("active", b.dataset.u === rpUnit));
  const bbAmt = Math.round(rec.net / rec.bb * 10) / 10;
  document.getElementById("rpTitle").innerHTML =
    `<b>${rec.date}</b> · ${rec.hc} · ${rec.pos} · ` +
    `<span class="${bbAmt >= 0 ? "pos" : "neg"}">${bbAmt >= 0 ? "+" : ""}${bbAmt} bb</span>` +
    ` <span class="note">#${id}</span>`;
  document.getElementById("rpFelt").innerHTML =
    rpSeats(rec, rp) +
    `<div class="rp-board">${rp.b.length ? rp.b.map(pcard).join("") :
      `<span class="note" style="color:#cfe3d8;">未見翻牌</span>`}</div>` +
    `<div class="rp-pot">${rp.tp ? "總底池 " + money(rp.tp) : ""}</div>`;
  document.getElementById("rpStreets").innerHTML = rpStreets(rec, rp);
  rpModal.classList.remove("hidden");
}

function wireReplayButtons(root) {
  root.querySelectorAll("button[data-replay]").forEach(b => {
    b.onclick = () => openReplay(b.dataset.replay);
  });
}

document.querySelectorAll("#rpUnit button").forEach(b => {
  b.onclick = () => {
    rpUnit = b.dataset.u;
    saveUI({ unit: rpUnit });
    if (rpOpenId) openReplay(rpOpenId);   // re-render in the new unit
  };
});

document.getElementById("rpClose").onclick = () => rpModal.classList.add("hidden");
rpModal.onclick = e => { if (e.target === rpModal) rpModal.classList.add("hidden"); };
document.addEventListener("keydown", e => {
  if (e.key === "Escape") rpModal.classList.add("hidden");
});
