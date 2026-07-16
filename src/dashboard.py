"""Generate a self-contained HTML dashboard from GG hand histories.

Usage: python src/dashboard.py <hands_dir> [-o dashboard.html]
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from hand_parser import parse_dir
from analyze import preflop_decisions
from ranges import (classify, RANKS, RFI, VS_OPEN, VS_3BET,
                    SB_RAISE, SB_LIMP,
                    rfi_action, vs_open_action, vs_3bet_action)

POS_ORDER = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]


def all_classes():
    out = []
    for i in range(13):
        for j in range(13):
            if i == j:
                out.append(RANKS[i] * 2)
            elif i < j:
                out.append(RANKS[i] + RANKS[j] + "s")
            else:
                out.append(RANKS[j] + RANKS[i] + "o")
    return out


def build_range_tables():
    """Export every baseline table as {spot_key: {hand_class: action}}."""
    tables = {}
    classes = all_classes()
    for pos in ["UTG", "HJ", "CO", "BTN"]:
        key = f"RFI {pos}"
        tables[key] = {c: ("raise" if c in RFI[pos] else "fold") for c in classes}
    tables["RFI SB"] = {
        c: ("raise" if c in SB_RAISE else "limp" if c in SB_LIMP else "fold")
        for c in classes}
    for (hero, opener) in sorted(VS_OPEN, key=lambda k: (POS_ORDER.index(k[0]), POS_ORDER.index(k[1]))):
        key = f"{hero} vs {opener} open"
        tables[key] = {c: vs_open_action(hero, opener, c) for c in classes}
    for (hero, tb) in VS_3BET:
        key = f"{hero} open 被 {tb} 3bet"
        tables[key] = {c: vs_3bet_action(hero, tb, c) for c in classes}
    return tables


# Goal: profit target (USD, rake already reflected in hand results) at a stake.
GOAL = {"label": "NL10 贏 $500 升級", "target_usd": 500.0, "bb": 0.1}


def build_data(hands):
    sessions = defaultdict(lambda: {
        "hands": 0, "net_bb": 0.0, "decisions": 0, "mistakes": 0})
    goal_usd = defaultdict(float)  # date -> USD net at goal stake
    mistakes = []
    cat_count = defaultdict(int)
    grid = defaultdict(lambda: [0, 0])  # hand_class -> [decisions, mistakes]

    for h in hands:
        if not h.hero_cards or not h.hero_position:
            continue
        date = h.timestamp[:10]
        s = sessions[date]
        s["hands"] += 1
        s["net_bb"] += h.hero_net_bb
        if abs(h.bb - GOAL["bb"]) < 1e-9:
            goal_usd[date] += h.hero_net
        hc = classify(*h.hero_cards)
        for d in preflop_decisions(h, hc):
            s["decisions"] += 1
            grid[hc][0] += 1
            if not d["ok"]:
                s["mistakes"] += 1
                grid[hc][1] += 1
                cat_count[d["category"]] += 1
                mistakes.append({
                    "date": date, "hand": hc, "pos": h.hero_position,
                    "spot": d["spot"], "key": d["key"], "actual": d["actual"],
                    "correct": d["correct"], "category": d["category"],
                    "net_bb": round(h.hero_net_bb, 1), "id": h.hand_id,
                })

    session_rows = []
    for date in sorted(sessions):
        s = sessions[date]
        session_rows.append({
            "date": date, "hands": s["hands"],
            "net_bb": round(s["net_bb"], 1),
            "bb100": round(100 * s["net_bb"] / s["hands"], 1) if s["hands"] else 0,
            "decisions": s["decisions"], "mistakes": s["mistakes"],
            "rate": round(100 * s["mistakes"] / s["decisions"], 1) if s["decisions"] else 0,
        })
    return {
        "sessions": session_rows,
        "mistakes": mistakes,
        "categories": sorted(cat_count.items(), key=lambda x: -x[1]),
        "grid": {k: v for k, v in grid.items()},
        "ranks": list(RANKS),
        "tables": build_range_tables(),
        "goal": {
            "label": GOAL["label"],
            "target": GOAL["target_usd"],
            "current": round(sum(goal_usd.values()), 2),
            "by_date": [{"date": d, "usd": round(v, 2)}
                        for d, v in sorted(goal_usd.items())],
        },
    }


TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>Poker 翻前檢討 Dashboard</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #10151a;          /* 牌室深色底(偏綠的冷黑) */
    --surface: #18202a;
    --surface2: #1f2937;
    --line: #2a3644;
    --ink: #e8ebee;
    --muted: #8d9aa8;
    --accent: #3aa87c;      /* 牌桌絨綠 */
    --accent-soft: #234639;
    --win: #4cc38a;
    --loss: #e5635c;
    --track: #2a3644;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f2f4f3; --surface: #ffffff; --surface2: #e9edeb;
      --line: #d5dcd8; --ink: #1c2420; --muted: #64716a;
      --accent: #22815e; --accent-soft: #d7eae0;
      --win: #1f8a5d; --loss: #c23e38; --track: #dde3df;
    }
  }
  :root[data-theme="dark"] {
    --bg: #10151a; --surface: #18202a; --surface2: #1f2937;
    --line: #2a3644; --ink: #e8ebee; --muted: #8d9aa8;
    --accent: #3aa87c; --accent-soft: #234639;
    --win: #4cc38a; --loss: #e5635c; --track: #2a3644;
  }
  :root[data-theme="light"] {
    --bg: #f2f4f3; --surface: #ffffff; --surface2: #e9edeb;
    --line: #d5dcd8; --ink: #1c2420; --muted: #64716a;
    --accent: #22815e; --accent-soft: #d7eae0;
    --win: #1f8a5d; --loss: #c23e38; --track: #dde3df;
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Microsoft JhengHei", system-ui, sans-serif;
    margin: 0; background: var(--bg); color: var(--ink);
    line-height: 1.55;
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 36px 24px 72px; }
  header.top { display: flex; align-items: baseline; gap: 12px;
               border-bottom: 2px solid var(--accent); padding-bottom: 14px; }
  h1 { font-size: 21px; margin: 0; letter-spacing: .01em; }
  .sub { color: var(--muted); font-size: 12.5px; }
  h2 { font-size: 12px; margin: 44px 0 10px; color: var(--accent);
       text-transform: uppercase; letter-spacing: .14em; font-weight: 600; }
  h2 .zh { display: block; text-transform: none; letter-spacing: 0;
           color: var(--ink); font-size: 16.5px; margin-top: 2px; }
  section > .panel { background: var(--surface); border: 1px solid var(--line);
                     border-radius: 12px; padding: 18px 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
           gap: 12px; margin-top: 20px; }
  .card { background: var(--surface); border: 1px solid var(--line);
          border-radius: 12px; padding: 14px 16px; }
  .card .v { font-size: 24px; font-weight: 650;
             font-variant-numeric: tabular-nums; }
  .card .k { font-size: 12px; color: var(--muted); margin-top: 2px; }
  table { border-collapse: collapse; font-size: 13px; width: 100%;
          font-variant-numeric: tabular-nums; }
  .tablewrap { overflow-x: auto; background: var(--surface);
               border: 1px solid var(--line); border-radius: 12px; padding: 6px 14px 10px; }
  th, td { padding: 7px 12px; border-bottom: 1px solid var(--line); text-align: right; }
  tbody tr:last-child td { border-bottom: none; }
  th { color: var(--muted); font-weight: 500; font-size: 12px; }
  td:first-child, th:first-child { text-align: left; }
  .pos { color: var(--win); } .neg { color: var(--loss); }
  #chart { background: var(--surface); border: 1px solid var(--line);
           border-radius: 12px; width: 100%; height: auto; }
  .gridwrap { display: grid; grid-template-columns: repeat(13, minmax(30px, 1fr));
              gap: 2px; }
  .cell { height: 30px; font-size: 10px; display: flex; align-items: center;
          justify-content: center; border-radius: 4px;
          background: var(--surface2); color: var(--muted); }
  .big .cell { height: 42px; font-size: 11px; position: relative; }
  .badge { position: absolute; top: 1px; right: 2px; font-size: 9px;
           font-weight: 700; padding: 0 4px; border-radius: 6px; color: #10151a; }
  .lg { display: inline-block; margin-right: 12px; }
  .lg span { display: inline-block; width: 10px; height: 10px; border-radius: 2px;
             margin-right: 4px; vertical-align: -1px; }
  select { background: var(--surface); color: var(--ink);
           border: 1px solid var(--line); border-radius: 8px; padding: 5px 10px;
           font-size: 13px; }
  select:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  label { font-size: 13px; }
  .note { color: var(--muted); font-size: 12px; }
  .controls { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <h1>撲克翻前檢討</h1>
  <span class="sub">Natural8 · 6max 100bb · 基準:GTO Wizard NL25</span>
</header>
<div class="cards" id="summary"></div>

<section>
<h2>Goal<span class="zh" id="goalTitle"></span></h2>
<div class="panel">
  <div style="background:var(--track); border-radius:8px; height:24px; overflow:hidden;">
    <div id="goalBar" style="height:100%; border-radius:8px;
         background:var(--win); width:0%; transition:width .6s;"></div>
  </div>
  <div id="goalText" style="margin-top:10px; font-size:14px;
       font-variant-numeric: tabular-nums;"></div>
  <div id="goalDates" class="note" style="margin-top:4px;"></div>
</div>
</section>

<section>
<h2>Trend<span class="zh">翻前偏差率趨勢(目標:逐期下降)</span></h2>
<svg id="chart" viewBox="0 0 820 260" width="820" height="260"></svg>
</section>

<section>
<h2>Sessions<span class="zh">分期明細</span></h2>
<div class="tablewrap">
<table id="sessions"><thead><tr>
<th>日期</th><th>手數</th><th>盈虧(bb)</th><th>bb/100</th>
<th>判定決策</th><th>偏差</th><th>偏差率</th></tr></thead><tbody></tbody></table>
</div>
</section>

<section>
<h2>Leak types<span class="zh">偏差類型</span></h2>
<div class="tablewrap" style="max-width:460px;">
<table id="cats"><thead><tr><th>類型</th><th>次數</th></tr></thead><tbody></tbody></table>
</div>
</section>

<section>
<h2>Ranges<span class="zh">基準範圍表檢視</span></h2>
<div class="controls">
  <select id="spotSel"></select>
  <label><input type="checkbox" id="showErr" checked> 疊上我的錯誤</label>
</div>
<div id="legend" class="note" style="margin-bottom:8px;"></div>
<div class="gridwrap big" id="rangeGrid"></div>
</section>

<section>
<h2>Heatmap<span class="zh">13×13 起手牌:紅=常打錯(格內為 錯誤/判定)</span></h2>
<div class="gridwrap" id="grid"></div>
</section>

<section>
<h2>Mistakes<span class="zh">偏差清單</span></h2>
<div class="controls"><select id="dateFilter"><option value="">全部期別</option></select></div>
<div class="tablewrap">
<table id="mistakes"><thead><tr>
<th>日期</th><th>手牌</th><th>位置</th><th>情境</th><th>你的動作</th>
<th>基準</th><th>類型</th><th>結果(bb)</th><th>Hand ID</th></tr></thead><tbody></tbody></table>
</div>
<p class="note">基準:GTO Wizard 6max NL25 100bb 純策略簡化版。混頻邊界牌的標記僅供參考。</p>
</section>
</div>

<script>
const DATA = /*DATA*/;

const fmt = (n) => (n > 0 ? "+" : "") + n;
const cls = (n) => n >= 0 ? "pos" : "neg";

// summary cards
const totH = DATA.sessions.reduce((a, s) => a + s.hands, 0);
const totNet = DATA.sessions.reduce((a, s) => a + s.net_bb, 0);
const totD = DATA.sessions.reduce((a, s) => a + s.decisions, 0);
const totM = DATA.sessions.reduce((a, s) => a + s.mistakes, 0);
document.getElementById("summary").innerHTML = [
  ["總手數", totH], ["總盈虧 (bb)", `<span class="${cls(totNet)}">${fmt(Math.round(totNet))}</span>`],
  ["bb/100", `<span class="${cls(totNet)}">${fmt((100 * totNet / totH).toFixed(1))}</span>`],
  ["翻前偏差率", (100 * totM / totD).toFixed(1) + "%"],
  ["偏差 / 判定", `${totM} / ${totD}`],
].map(([k, v]) => `<div class="card"><div class="v">${v}</div><div class="k">${k}</div></div>`).join("");

// goal progress bar
const G = DATA.goal;
document.getElementById("goalTitle").textContent = "升級目標:" + G.label;
const pctG = Math.min(100, 100 * G.current / G.target);
const bar = document.getElementById("goalBar");
bar.style.width = Math.min(100, Math.abs(pctG)) + "%";
if (G.current < 0) bar.style.background = "var(--loss)";
document.getElementById("goalText").innerHTML =
  `<b class="${cls(G.current)}">$${G.current.toFixed(2)}</b> / $${G.target.toFixed(0)}` +
  `(${pctG.toFixed(1)}%)　還差 $${Math.max(0, G.target - G.current).toFixed(2)}`;
document.getElementById("goalDates").textContent =
  "各期 NL10 盈虧:" + G.by_date.map(d => `${d.date.slice(5)} ${d.usd >= 0 ? "+" : ""}${d.usd}`).join("、") +
  "(金額為扣除抽水後實拿;未含 Fish Buffet 返水)";

// trend chart (SVG line)
const svg = document.getElementById("chart");
const W = 820, H = 260, P = 44;
const ss = DATA.sessions;
const maxR = Math.max(15, ...ss.map(s => s.rate)) * 1.15;
const x = (i) => ss.length === 1 ? W / 2 : P + i * (W - 2 * P) / (ss.length - 1);
const y = (r) => H - P - r / maxR * (H - 2 * P);
let el = "";
for (let g = 0; g <= 4; g++) {
  const r = maxR * g / 4, yy = y(r);
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

// sessions table
document.querySelector("#sessions tbody").innerHTML = ss.map(s =>
  `<tr><td>${s.date}</td><td>${s.hands}</td><td class="${cls(s.net_bb)}">${fmt(s.net_bb)}</td>` +
  `<td class="${cls(s.bb100)}">${fmt(s.bb100)}</td><td>${s.decisions}</td>` +
  `<td>${s.mistakes}</td><td><b>${s.rate}%</b></td></tr>`).join("");

// categories
document.querySelector("#cats tbody").innerHTML =
  DATA.categories.map(([c, n]) => `<tr><td>${c}</td><td>${n}</td></tr>`).join("");

// 13x13 grid
const R = DATA.ranks;
let cells = "";
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
  const name = i === j ? R[i] + R[j] :
    (i < j ? R[i] + R[j] + "s" : R[j] + R[i] + "o");
  const g = DATA.grid[name];
  let style = "", label = name;
  if (g) {
    const rate = g[1] / g[0];
    if (g[1] > 0) {
      const a = Math.min(0.9, 0.25 + rate * 0.65);
      style = `background: rgba(220,70,70,${a}); color: #fff;`;
      label = `${name}<br>${g[1]}/${g[0]}`;
    } else {
      style = "background:var(--accent-soft); color:var(--accent);";
    }
  }
  cells += `<div class="cell" style="${style}"><div style="text-align:center">${label}</div></div>`;
}
document.getElementById("grid").innerHTML = cells;

// ---- baseline range viewer with mistake overlay ----
const ACT_COLOR = { raise: "#c0392b", "3bet": "#c0392b", "4bet": "#c0392b",
                    call: "#2e8b57", limp: "#57a06a", fold: "#31537d" };
const CAT_COLOR = {
  "RFI 太緊(該 open 沒 open)": "#ffd84d",
  "太緊(該防守沒防守)": "#ffd84d",
  "call 過鬆": "#ff9d3b",
  "RFI 太鬆(open 過寬)": "#ff6b6b",
  "該 3bet 卻 call": "#b78bff",
  "3bet 選牌錯": "#ff7bd5",
  "該 call 卻 3bet": "#6bd6ff",
  "RFI 用 limp": "#a0e070",
  "vs 3bet 應對錯": "#ffffff",
};
const spotSel = document.getElementById("spotSel");
Object.keys(DATA.tables).forEach(k => {
  spotSel.innerHTML += `<option value="${k}">${k}</option>`;
});
const showErr = document.getElementById("showErr");

function renderRange() {
  const key = spotSel.value, table = DATA.tables[key];
  const errs = {};
  if (showErr.checked) {
    DATA.mistakes.filter(m => m.key === key).forEach(m => {
      (errs[m.hand] = errs[m.hand] || []).push(m);
    });
  }
  let html = "";
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
    const name = i === j ? R[i] + R[j] :
      (i < j ? R[i] + R[j] + "s" : R[j] + R[i] + "o");
    const act = table[name] || "fold";
    let inner = name, extra = "", title = `${name}:${act}`;
    const e = errs[name];
    if (e) {
      const c = CAT_COLOR[e[0].category] || "#fff";
      extra = `outline: 2px solid ${c}; outline-offset: -2px;`;
      inner = name + `<span class="badge" style="background:${c}">${e.length}</span>`;
      title = e.map(m => `${m.date} ${m.spot}:你 ${m.actual},基準 ${m.correct} (${m.net_bb}bb)`).join("\n");
    }
    html += `<div class="cell" title="${title}" style="background:${ACT_COLOR[act]}; color:#eee; ${extra}">${inner}</div>`;
  }
  document.getElementById("rangeGrid").innerHTML = html;

  const cats = [...new Set(DATA.mistakes.filter(m => m.key === key).map(m => m.category))];
  document.getElementById("legend").innerHTML =
    `<span class="lg"><span style="background:#c0392b"></span>raise/3bet/4bet</span>` +
    `<span class="lg"><span style="background:#2e8b57"></span>call</span>` +
    (key === "RFI SB" ? `<span class="lg"><span style="background:#57a06a"></span>limp</span>` : "") +
    `<span class="lg"><span style="background:#31537d"></span>fold</span>` +
    (showErr.checked ? cats.map(c =>
      `<span class="lg"><span style="background:${CAT_COLOR[c] || "#fff"}"></span>${c}</span>`).join("") : "");
}
spotSel.onchange = renderRange;
showErr.onchange = renderRange;
renderRange();

// mistakes list with date filter
const sel = document.getElementById("dateFilter");
[...new Set(DATA.mistakes.map(m => m.date))].forEach(d => {
  sel.innerHTML += `<option value="${d}">${d}</option>`;
});
function renderMistakes() {
  const f = sel.value;
  document.querySelector("#mistakes tbody").innerHTML = DATA.mistakes
    .filter(m => !f || m.date === f)
    .map(m => `<tr><td>${m.date}</td><td>${m.hand}</td><td>${m.pos}</td><td>${m.spot}</td>` +
      `<td>${m.actual}</td><td>${m.correct}</td><td>${m.category}</td>` +
      `<td class="${cls(m.net_bb)}">${fmt(m.net_bb)}</td><td>${m.id}</td></tr>`).join("");
}
sel.onchange = renderMistakes;
renderMistakes();
</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("hands_dir")
    ap.add_argument("-o", "--output", default="dashboard.html")
    args = ap.parse_args()

    hands = parse_dir(args.hands_dir)
    data = build_data(hands)
    html = TEMPLATE.replace("/*DATA*/", json.dumps(data, ensure_ascii=False))
    Path(args.output).write_text(html, encoding="utf-8")
    n = sum(s["hands"] for s in data["sessions"])
    print(f"{n} hands, {len(data['sessions'])} sessions -> {args.output}")


if __name__ == "__main__":
    main()
