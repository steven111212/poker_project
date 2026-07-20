// ---------- rendering ----------
const fmt = n => (n > 0 ? "+" : "") + n;
const cls = n => n >= 0 ? "pos" : "neg";
const CAT_COLOR_BASE = {
  "RFI 太緊(該 open 沒 open)": "#ffd84d", "太緊(該防守沒防守)": "#ffd84d",
  "call 過鬆": "#ff9d3b", "RFI 太鬆(open 過寬)": "#ff6b6b",
  "RFI 用 limp": "#a0e070", "應對錯": "#ffffff",
};
function catColor(c) {
  if (CAT_COLOR_BASE[c]) return CAT_COLOR_BASE[c];
  if (/^該 .*卻 call$/.test(c)) return "#b78bff";
  if (/選牌錯$/.test(c)) return "#ff7bd5";
  if (/^該 call 卻/.test(c)) return "#6bd6ff";
  return "#ffffff";
}
const C_RAISE = "#c0392b", C_ALLIN = "#7d1f4e", C_CALL = "#2e8b57",
      C_FOLD = "#31537d";
const dateFilter = document.getElementById("dateFilter");

function computeData() {
  const store = loadStore();
  const hands = Object.values(store.hands);
  const sessions = {}, mistakes = [], cats = {}, grid = {};
  for (const h of hands) {
    const s = sessions[h.date] = sessions[h.date] ||
      { date: h.date, hands: 0, net_bb: 0, decisions: 0, mist: 0 };
    s.hands++; s.net_bb += h.net / h.bb;
    for (const d of decisionsOf(h)) {
      s.decisions++;
      (grid[h.hc] = grid[h.hc] || [0, 0])[0]++;
      if (!d.ok) {
        s.mist++; grid[h.hc][1]++;
        cats[d.cat] = (cats[d.cat] || 0) + 1;
        mistakes.push({ date: h.date, hand: h.hc, pos: h.pos, spot: d.spot,
          key: d.key, actual: d.actual, correct: d.correct, cat: d.cat,
          net_bb: Math.round(h.net / h.bb * 10) / 10, id: h.id });
      }
    }
  }
  // HUD aggregation over hands that carry stat flags
  const hud = { n: 0, v: 0, p: 0, t3: [0, 0], ats: [0, 0], sf: 0, wt: 0,
                wsd: 0, ag: [0, 0], cb: [[0, 0], [0, 0]],
                fcb: [[0, 0, 0, 0], [0, 0, 0, 0]] };
  for (const h of hands) {
    const s = h.st;
    if (!s || s.ver !== ST_VER) continue;
    hud.n++; hud.v += s.v; hud.p += s.p;
    hud.t3[0] += s.t3[0]; hud.t3[1] += s.t3[1];
    hud.ats[0] += s.ats[0]; hud.ats[1] += s.ats[1];
    hud.sf += s.sf; hud.wt += s.wt; hud.wsd += s.wsd;
    hud.ag[0] += s.ag[0]; hud.ag[1] += s.ag[1];
    for (let i = 0; i < 2; i++) {
      hud.cb[i][0] += s.cb[i][0]; hud.cb[i][1] += s.cb[i][1];
      for (let j = 0; j < 4; j++) hud.fcb[i][j] += s.fcb[i][j];
    }
  }

  const rows = Object.values(sessions).sort((a, b) => a.date < b.date ? -1 : 1);
  rows.forEach(s => {
    s.net_bb = Math.round(s.net_bb * 10) / 10;
    s.bb100 = s.hands ? Math.round(1000 * s.net_bb / s.hands) / 10 : 0;
    s.rate = s.decisions ? Math.round(1000 * s.mist / s.decisions) / 10 : 0;
  });
  return { hands, rows, mistakes, cats, grid, hud };
}

const isOff = (val, n, lo, hi) => val !== null && n >= 30 && (val < lo || val > hi);

function hudDonut([name, desc, val, n, lo, hi]) {
  const r = 34, c = 2 * Math.PI * r;
  const off = isOff(val, n, lo, hi);
  const color = off ? "var(--loss)" : "var(--accent)";
  const dash = val === null ? 0 : Math.min(100, val) / 100 * c;
  return `<div class="donut" title="${desc}:樣本 ${n},參考 ${lo}–${hi}%">
    <svg viewBox="0 0 90 90" width="92" height="92" role="img" aria-label="${name}">
      <circle cx="45" cy="45" r="${r}" fill="none" stroke="var(--track)" stroke-width="8"/>
      <circle cx="45" cy="45" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}"
        transform="rotate(-90 45 45)"/>
      <text x="45" y="50" text-anchor="middle" font-size="17" font-weight="650"
        fill="var(--ink)">${val === null ? "-" : Math.round(val) + "%"}</text>
    </svg>
    <div class="k">${name}</div><div class="range">${lo}–${hi}%</div></div>`;
}

function hudMeter([name, desc, val, n, lo, hi]) {
  const off = isOff(val, n, lo, hi);
  const color = off ? "var(--loss)" : "var(--accent)";
  const disp = val === null ? "-" : val.toFixed(1) + "%";
  return `<div class="mrow" title="${desc}:樣本 ${n},參考 ${lo}–${hi}%">
    <span class="ml">${name}</span>
    <span class="mbar"><span style="width:${val === null ? 0 : Math.min(100, val)}%;
      background:${color};"></span></span>
    <span class="mv ${off ? "neg" : ""}">${disp}</span></div>`;
}

function renderHUD(D) {
  const H = D.hud;
  const note = document.getElementById("hudNote");
  const tbody = document.querySelector("#hud tbody");
  const viz = document.getElementById("hudViz");
  if (!H.n) {
    tbody.innerHTML = ""; viz.innerHTML = "";
    note.textContent = D.hands.length
      ? "已存的手牌還沒有(新版)HUD 統計——把原本的 .zip/.txt 再拖進上傳區一次,舊資料會自動升級(不會重複)。"
      : "上傳手牌後,這裡會顯示 VPIP / PFR / 3-bet 等整體數據。";
    return;
  }
  const pct = (num, den) => den ? (100 * num / den) : null;
  const rows = [
    ["VPIP", "翻前主動進池率", pct(H.v, H.n), H.n, 22, 27],
    ["PFR", "翻前加注率", pct(H.p, H.n), H.n, 17, 22],
    ["3BET", "面對 open 再加注", pct(H.t3[1], H.t3[0]), H.t3[0], 7, 10],
    ["ATS", "後位偷盲率", pct(H.ats[1], H.ats[0]), H.ats[0], 35, 45],
    ["CB 翻牌", "翻牌持續下注", pct(H.cb[0][1], H.cb[0][0]), H.cb[0][0], 55, 70],
    ["CB 轉牌", "轉牌持續下注", pct(H.cb[1][1], H.cb[1][0]), H.cb[1][0], 45, 55],
    ["FCB 翻牌", "面對翻牌 c-bet 棄牌", pct(H.fcb[0][1], H.fcb[0][0]), H.fcb[0][0], 40, 50],
    ["FCB 轉牌", "面對轉牌 c-bet 棄牌", pct(H.fcb[1][1], H.fcb[1][0]), H.fcb[1][0], 35, 48],
    ["WTSD", "見翻牌後打到攤牌", pct(H.wt, H.sf), H.sf, 24, 30],
    ["WSD", "攤牌勝率", pct(H.wsd, H.wt), H.wt, 50, 55],
    ["TAF", "翻後侵略頻率(bet+raise ÷ 所有翻後動作)", pct(H.ag[0], H.ag[0] + H.ag[1]), H.ag[0] + H.ag[1], 25, 35],
  ];
  viz.innerHTML =
    `<div class="hudrow">${rows.slice(0, 4).map(hudDonut).join("")}</div>` +
    `<div class="streets">` +
    [["翻牌", [rows[4], rows[6]]],
     ["轉牌", [rows[5], rows[7]]],
     ["攤牌 / 整體", [rows[8], rows[9], rows[10]]]].map(([t, rs]) =>
      `<div class="panel"><b class="t">${t}</b>${rs.map(hudMeter).join("")}</div>`
    ).join("") + `</div>`;
  tbody.innerHTML = rows.map(([name, desc, val, n, lo, hi]) => {
    const disp = val === null ? "-" : val.toFixed(1) + "%";
    const off = isOff(val, n, lo, hi);
    return `<tr><td><b>${name}</b></td><td class="note">${desc}</td>` +
      `<td class="${off ? "neg" : ""}" style="font-weight:600;">${disp}${off ? " ⚠" : ""}</td>` +
      `<td>${n}</td><td class="note">${lo}–${hi}%</td></tr>`;
  }).join("");
  note.textContent = `統計樣本 ${H.n} 手` +
    (H.n < D.hands.length
      ? `(另有 ${D.hands.length - H.n} 手是舊版統計未計入——重新拖入原檔即可升級)`
      : "") +
    "。紅色 = 超出參考區間;區間為 6-max 現金桌常見值,僅供對照。";
}

function renderAll() {
  const D = window._D = computeData();
  document.getElementById("storeInfo").textContent = `目前已儲存 ${D.hands.length} 手`;

  const g = loadGoal();
  goalStake.value = String(g.bb); goalTarget.value = g.target;
  const cur = D.hands.filter(h => Math.abs(h.bb - g.bb) < 1e-9)
                     .reduce((a, h) => a + h.net, 0);
  const curR = Math.round(cur * 100) / 100;
  const pct = Math.min(100, 100 * curR / g.target);
  const bar = document.getElementById("goalBar");
  bar.style.width = Math.min(100, Math.abs(pct)) + "%";
  bar.style.background = curR < 0 ? "var(--loss)" : "var(--win)";
  document.getElementById("goalText").innerHTML =
    `<b class="${cls(curR)}">$${curR.toFixed(2)}</b> / $${g.target}` +
    `(${pct.toFixed(1)}%)　還差 $${Math.max(0, g.target - curR).toFixed(2)}`;

  const totH = D.hands.length;
  const totNet = D.rows.reduce((a, s) => a + s.net_bb, 0);
  const totD = D.rows.reduce((a, s) => a + s.decisions, 0);
  const totM = D.rows.reduce((a, s) => a + s.mist, 0);
  const totRake = D.hands.reduce((a, h) => a + (h.rk || 0), 0);
  const rakeBB = D.hands.reduce((a, h) => a + (h.rk || 0) / h.bb, 0);
  const preNet = totNet + rakeBB;
  document.getElementById("summary").innerHTML = totH ? [
    ["總手數", totH],
    ["總盈虧 (bb)", `<span class="${cls(totNet)}">${fmt(Math.round(totNet))}</span>`],
    ["bb/100(稅後)", `<span class="${cls(totNet)}">${fmt((100 * totNet / totH).toFixed(1))}</span>`],
    ["bb/100(稅前)", `<span class="${cls(preNet)}">${fmt((100 * preNet / totH).toFixed(1))}</span>`],
    ["翻前偏差率", totD ? (100 * totM / totD).toFixed(1) + "%" : "-"],
    ["偏差 / 判定", `${totM} / ${totD}`],
    ["已付抽水 $", totRake.toFixed(2)],
  ].map(([k, v]) => `<div class="card"><div class="v">${v}</div><div class="k">${k}</div></div>`).join("")
  : `<div class="card"><div class="v">尚無資料</div><div class="k">先上傳手牌開始追蹤</div></div>`;

  renderHUD(D);
  renderWinnings(D);

  const svg = document.getElementById("chart");
  const W = 820, H = 260, P = 44, ss = D.rows;
  if (!ss.length) svg.innerHTML = "";
  else {
    const maxR = Math.max(15, ...ss.map(s => s.rate)) * 1.15;
    const x = i => ss.length === 1 ? W / 2 : P + i * (W - 2 * P) / (ss.length - 1);
    const y = r => H - P - r / maxR * (H - 2 * P);
    let el = "";
    for (let gg = 0; gg <= 4; gg++) {
      const r = maxR * gg / 4, yy = y(r);
      el += `<line x1="${P}" x2="${W - P}" y1="${yy}" y2="${yy}" stroke="var(--line)"/>` +
            `<text x="${P - 8}" y="${yy + 4}" fill="var(--muted)" font-size="11" text-anchor="end">${r.toFixed(0)}%</text>`;
    }
    el += `<polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="` +
          ss.map((s, i) => `${x(i)},${y(s.rate)}`).join(" ") + `"/>`;
    ss.forEach((s, i) => {
      el += `<circle cx="${x(i)}" cy="${y(s.rate)}" r="4" fill="var(--accent)"/>` +
            `<text x="${x(i)}" y="${y(s.rate) - 10}" fill="var(--ink)" font-size="11" text-anchor="middle">${s.rate}%</text>` +
            `<text x="${x(i)}" y="${H - P + 18}" fill="var(--muted)" font-size="11" text-anchor="middle">${s.date.slice(5)}</text>`;
    });
    svg.innerHTML = el;
  }

  document.querySelector("#sessions tbody").innerHTML = ss.map(s =>
    `<tr><td>${s.date}</td><td>${s.hands}</td><td class="${cls(s.net_bb)}">${fmt(s.net_bb)}</td>` +
    `<td class="${cls(s.bb100)}">${fmt(s.bb100)}</td><td>${s.decisions}</td>` +
    `<td>${s.mist}</td><td><b>${s.rate}%</b></td></tr>`).join("");

  document.querySelector("#cats tbody").innerHTML =
    Object.entries(D.cats).sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `<tr><td>${c}</td><td>${n}</td></tr>`).join("");

  let cells = "";
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
    const name = i === j ? RANKS[i] + RANKS[j] :
      (i < j ? RANKS[i] + RANKS[j] + "s" : RANKS[j] + RANKS[i] + "o");
    const gg = D.grid[name];
    let style = "", label = name, clickable = "";
    if (gg) {
      if (gg[1] > 0) {
        const a = Math.min(0.9, 0.25 + gg[1] / gg[0] * 0.65);
        style = `background:rgba(220,70,70,${a}); color:#fff;`;
        label = `${name}<br>${gg[1]}/${gg[0]}`;
        clickable = " clickable";
      } else style = "background:var(--accent-soft); color:var(--accent);";
    }
    cells += `<div class="cell${clickable}" data-hand="${name}"
      style="${style}"><div style="text-align:center">${label}</div></div>`;
  }
  const gridEl2 = document.getElementById("grid");
  gridEl2.innerHTML = cells;
  gridEl2.querySelectorAll(".cell.clickable").forEach(el => {
    el.onclick = () => showHandDetail(el.dataset.hand);
  });

  refreshSpotOptions();
  renderPicker(); renderMistakes(true);
  renderJournal(D); renderNotes();
}

const winStake = document.getElementById("winStake");
winStake.onchange = () => renderWinnings(window._D || computeData());

function renderWinnings(D) {
  // stake filter options
  const stakes = [...new Set(D.hands.map(h => h.bb))].sort((a, b) => a - b);
  const cur = winStake.value;
  winStake.innerHTML = `<option value="">全部級別(bb)</option>` +
    stakes.map(b => `<option value="${b}">NL${Math.round(b * 100)}</option>`).join("");
  winStake.value = cur && stakes.includes(+cur) ? cur : "";

  const sel = winStake.value ? +winStake.value : null;
  const hands = D.hands
    .filter(h => sel === null || Math.abs(h.bb - sel) < 1e-9)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 :
                    (a.id < b.id ? -1 : 1));
  const svg = document.getElementById("winChart");
  if (!hands.length) { svg.innerHTML = "";
    document.getElementById("winInfo").textContent = ""; return; }

  let acc = 0;
  const pts = hands.map(h => (acc += h.net / h.bb));
  const n = pts.length;
  const bb100 = 100 * acc / n;
  document.getElementById("winInfo").textContent =
    `${n} 手 · ${acc >= 0 ? "+" : ""}${acc.toFixed(0)} bb · bb/100:` +
    `${bb100 >= 0 ? "+" : ""}${bb100.toFixed(1)}`;

  const W = 820, H = 260, P = 44;
  const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts);
  const span = (hi - lo) || 1;
  const x = i => P + i * (W - 2 * P) / Math.max(1, n - 1);
  const y = v => H - P - (v - lo) / span * (H - 2 * P);
  // downsample for smooth rendering
  const step = Math.max(1, Math.floor(n / 400));
  const poly = [];
  for (let i = 0; i < n; i += step) poly.push(`${x(i).toFixed(1)},${y(pts[i]).toFixed(1)}`);
  if ((n - 1) % step !== 0) poly.push(`${x(n - 1).toFixed(1)},${y(pts[n - 1]).toFixed(1)}`);

  let el = "";
  // gridlines
  for (let g = 0; g <= 4; g++) {
    const v = lo + span * g / 4, yy = y(v);
    el += `<line x1="${P}" x2="${W - P}" y1="${yy}" y2="${yy}" stroke="var(--line)"/>` +
          `<text x="${P - 8}" y="${yy + 4}" fill="var(--muted)" font-size="11" text-anchor="end">${v.toFixed(0)}</text>`;
  }
  // zero line emphasized
  if (lo < 0 && hi > 0)
    el += `<line x1="${P}" x2="${W - P}" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
  // area fill + line
  const areaColor = acc >= 0 ? "var(--win)" : "var(--loss)";
  el += `<polyline fill="none" stroke="${areaColor}" stroke-width="2" points="${poly.join(" ")}"/>`;
  // endpoint
  el += `<circle cx="${x(n - 1)}" cy="${y(pts[n - 1])}" r="4" fill="${areaColor}"/>` +
        `<text x="${x(n - 1) - 6}" y="${y(pts[n - 1]) - 10}" fill="var(--ink)" font-size="11" text-anchor="end">${acc >= 0 ? "+" : ""}${acc.toFixed(0)} bb</text>`;
  // x labels: hand counts
  for (let g = 0; g <= 4; g++) {
    const i = Math.round((n - 1) * g / 4);
    el += `<text x="${x(i)}" y="${H - P + 18}" fill="var(--muted)" font-size="11" text-anchor="middle">${i + 1}</text>`;
  }
  svg.innerHTML = el;
}

function renderRange() {
  const D = window._D || computeData();
  const key = spotSel.value;
  const cust = loadCustom()[key] || {};
  const errs = {};
  if (showErr.checked)
    D.mistakes.filter(m => m.key === key).forEach(m =>
      (errs[m.hand] = errs[m.hand] || []).push(m));
  let html = "";
  const combosOf = n => n.length === 2 ? 6 : (n[2] === "s" ? 4 : 12);
  let comboR = 0, comboC = 0, comboA = 0, comboTot = 0;
  for (const name of CLASSES) {
    const w = cellWeights(key, name);
    const wa = w.a || 0;
    const cmb = combosOf(name);
    comboR += cmb * w.r / 100; comboC += cmb * w.c / 100;
    comboA += cmb * wa / 100; comboTot += cmb;
    const stops = [];
    let acc = 0;
    if (w.r > 0) { stops.push(`${C_RAISE} ${acc}% ${acc + w.r}%`); acc += w.r; }
    if (wa > 0) { stops.push(`${C_ALLIN} ${acc}% ${acc + wa}%`); acc += wa; }
    if (w.c > 0) { stops.push(`${C_CALL} ${acc}% ${acc + w.c}%`); acc += w.c; }
    if (w.f > 0) { stops.push(`${C_FOLD} ${acc}% 100%`); }
    const bg = stops.length > 1 ?
      `linear-gradient(to right, ${stops.join(", ")})` :
      (w.r === 100 ? C_RAISE : wa === 100 ? C_ALLIN :
       w.c === 100 ? C_CALL : C_FOLD);
    let inner = name, extra = "",
        title = `${name}:raise ${w.r}${wa ? ` / allin ${wa}` : ""}` +
                ` / call ${w.c} / fold ${w.f}`;
    if (cust[name]) inner += `<span class="custommark">●</span>`;
    const e = errs[name];
    if (e) {
      const c = catColor(e[0].cat);
      extra = `outline:2px solid ${c}; outline-offset:-2px;`;
      inner = name + `<span class="badge" style="background:${c}">${e.length}</span>` +
              (cust[name] ? `<span class="custommark">●</span>` : "");
      title += "\n" + e.map(m =>
        `${m.date} ${m.spot}:你 ${m.actual},基準 ${m.correct} (${m.net_bb}bb)`).join("\n");
    }
    html += `<div class="cell" data-hand="${name}" title="${title}"
      style="background:${bg}; ${extra}">${inner}</div>`;
  }
  const gridEl = document.getElementById("rangeGrid");
  gridEl.innerHTML = html;
  gridEl.querySelectorAll(".cell").forEach(el => {
    el.onmousedown = e => { if (editMode.checked) { e.preventDefault();
      paintCell(el.dataset.hand); } };
    el.onmouseenter = e => { if (editMode.checked && e.buttons & 1)
      paintCell(el.dataset.hand); };
  });
  const raiseLbl = key.startsWith("RFI") ? "Open" :
                   key.includes(" vs ") ? "3-Bet" : "4-Bet";
  const callLbl = key.startsWith("RFI") ? "Limp/Call" : "Call";
  const pR = 100 * comboR / comboTot, pC = 100 * comboC / comboTot,
        pA = 100 * comboA / comboTot;
  const chip = (sw, lbl, p, n) =>
    `<span class="chip"><span class="sw" style="background:${sw}"></span>` +
    `${lbl} <b>${p.toFixed(1)}%</b><span class="note">${Math.round(n)} combos</span></span>`;
  document.getElementById("rangeStats").innerHTML =
    chip(C_RAISE, raiseLbl, pR, comboR) +
    (comboA > 0 ? chip(C_ALLIN, "All-in", pA, comboA) : "") +
    chip(C_CALL, callLbl, pC, comboC) +
    chip(C_FOLD, "Fold", 100 - pR - pC - pA,
         comboTot - comboR - comboC - comboA) +
    `<span class="chip">進池 <b>${(pR + pC + pA).toFixed(1)}%</b></span>`;
  document.getElementById("customInfo").textContent =
    `此表自訂了 ${Object.keys(cust).length} 格` +
    (DEFAULTS[key] ? "" : "(此情境無預設,從全 fold 開始)");
  const catsHere = [...new Set(D.mistakes.filter(m => m.key === key).map(m => m.cat))];
  document.getElementById("legend").innerHTML =
    `<span class="lg"><span style="background:${C_RAISE}"></span>raise/3bet/4bet</span>` +
    `<span class="lg"><span style="background:${C_ALLIN}"></span>allin</span>` +
    `<span class="lg"><span style="background:${C_CALL}"></span>call/limp</span>` +
    `<span class="lg"><span style="background:${C_FOLD}"></span>fold</span>` +
    `<span class="lg">● = 自訂格</span>` +
    (showErr.checked ? catsHere.map(c =>
      `<span class="lg"><span style="background:${catColor(c)}"></span>${c}</span>`).join("") : "");
}

function showHandDetail(hand) {
  const D = window._D || computeData();
  const handsById = loadStore().hands;
  const list = D.mistakes.filter(m => m.hand === hand);
  const panel = document.getElementById("handDetail");
  if (!list.length) { panel.classList.add("hidden"); return; }
  const total = (D.grid[hand] || [0, 0]);
  panel.classList.remove("hidden");
  panel.innerHTML =
    `<button class="close" title="關閉" aria-label="關閉">✕</button>` +
    `<b>${hand}</b> — 判定 ${total[0]} 次,打錯 ${total[1]} 次` +
    `<div class="tablewrap" style="border:none; padding:0;"><table><thead><tr>
      <th>日期</th><th>位置</th><th>情境</th><th>你的動作</th><th>基準</th>
      <th>類型</th><th>結果(bb)</th><th></th></tr></thead><tbody>` +
    list.map((m, i) =>
      `<tr><td>${m.date}</td><td>${m.pos}</td><td>${m.spot}</td>` +
      `<td>${m.actual}</td><td>${m.correct}</td><td>${m.cat}</td>` +
      `<td class="${cls(m.net_bb)}">${fmt(m.net_bb)}</td>` +
      `<td>${(handsById[m.id] || {}).rp ?
          `<button class="mini" data-replay="${m.id}">回顧牌局</button> ` : ""}` +
      `<button class="mini ghost" data-key="${m.key}" data-hand="${hand}">範圍表</button> ` +
      `<button class="mini ghost" data-note="${m.id}">${noteLabel(loadNotes(), m.id)}</button></td></tr>`
    ).join("") + `</tbody></table></div>`;
  panel.querySelector(".close").onclick = () => panel.classList.add("hidden");
  panel.querySelectorAll("button[data-key]").forEach(b => {
    b.onclick = () => jumpToRange(b.dataset.key, b.dataset.hand);
  });
  wireNoteButtons(panel);
  wireReplayButtons(panel);
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function jumpToRange(key, hand) {
  if (![...spotSel.options].some(o => o.value === key)) return;
  syncPicker(key);
  const target = document.querySelector(`#rangeGrid .cell[data-hand="${hand}"]`);
  document.getElementById("rangeGrid").scrollIntoView(
    { behavior: "smooth", block: "center" });
  if (target) {
    target.classList.remove("hl"); void target.offsetWidth;
    target.classList.add("hl");
  }
}

function renderMistakes(rebuildFilter) {
  const D = window._D || computeData();
  if (rebuildFilter) {
    const cur = dateFilter.value;
    dateFilter.innerHTML = `<option value="">全部期別</option>` +
      [...new Set(D.mistakes.map(m => m.date))].map(d =>
        `<option value="${d}">${d}</option>`).join("");
    dateFilter.value = cur || "";
  }
  const f = dateFilter.value;
  const notes = loadNotes();
  const handsById = loadStore().hands;
  const tbody = document.querySelector("#mistakes tbody");
  tbody.innerHTML = D.mistakes
    .filter(m => !f || m.date === f)
    .map(m => `<tr><td>${m.date}</td><td>${m.hand}</td><td>${m.pos}</td><td>${m.spot}</td>` +
      `<td>${m.actual}</td><td>${m.correct}</td><td>${m.cat}</td>` +
      `<td class="${cls(m.net_bb)}">${fmt(m.net_bb)}</td><td>${m.id}</td>` +
      `<td>${(handsById[m.id] || {}).rp ?
          `<button class="mini" data-replay="${m.id}">回顧</button> ` : ""}` +
      `<button class="mini ghost" data-note="${m.id}">${noteLabel(notes, m.id)}</button></td></tr>`).join("");
  wireNoteButtons(tbody);
  wireReplayButtons(tbody);
}

spotSel.onchange = renderRange;
showErr.onchange = renderRange;
dateFilter.onchange = () => renderMistakes(false);
