// ---------- preflop evaluation ----------
function preflopSpot(h) {
  const raises = []; let limpers = 0, callersOfRaise = 0;
  for (const a of h.actions) {
    if (a.street !== "preflop") continue;
    if (a.p === "Hero" && ["fold", "call", "raise", "check"].includes(a.kind)) {
      if (!raises.length && !limpers) return ["rfi", null, a.kind];
      if (raises.length === 1 && !callersOfRaise && !limpers)
        return ["vs_open", raises[0], a.kind];
      return [null, null, a.kind];
    }
    if (a.kind === "raise") raises.push(a.p);
    else if (a.kind === "call") { raises.length ? callersOfRaise++ : limpers++; }
  }
  return [null, null, null];
}

function vs3betSpot(h) {
  const raises = [];
  for (const a of h.actions) {
    if (a.street !== "preflop") continue;
    if (a.kind === "raise") { raises.push(a.p); continue; }
    if (a.p === "Hero" && ["fold", "call"].includes(a.kind)
        && raises.length === 2 && raises[0] === "Hero")
      return [raises[1], a.kind];
  }
  if (raises.length >= 3 && raises[0] === "Hero" && raises[2] === "Hero")
    return [raises[1], "raise"];
  return [null, null];
}

const RAISE_NAME = { rfi: "raise", vs_open: "3bet", vs_3bet: "4bet" };
function weightsLabel(w, kind) {
  const parts = [];
  if (w.r > 0) parts.push(`${RAISE_NAME[kind]} ${w.r}`);
  if (w.c > 0) parts.push(`${kind === "rfi" ? "limp/call" : "call"} ${w.c}`);
  if (w.f > 0) parts.push(`fold ${w.f}`);
  return parts.join(" / ") || "fold 100";
}

function categorize(kind, actual, w) {
  const dom = w.r >= w.c && w.r >= w.f ? "raise" : (w.c >= w.f ? "call" : "fold");
  if (kind === "rfi") {
    if (actual === "fold") return "RFI 太緊(該 open 沒 open)";
    if (actual === "limp/call") return "RFI 用 limp";
    return "RFI 太鬆(open 過寬)";
  }
  if (actual === "fold") return "太緊(該防守沒防守)";
  if (dom === "raise" && actual === "call") return `該 ${RAISE_NAME[kind]} 卻 call`;
  if (dom === "fold" && actual !== "fold")
    return actual === "call" ? "call 過鬆" : `${RAISE_NAME[kind]} 選牌錯`;
  if (dom === "call" && actual !== "call") return `該 call 卻 ${RAISE_NAME[kind]}`;
  return "應對錯";
}

function judge(key, hand, kind, actual) {
  // actual in {"raise","call","fold"} weight-space
  const w = cellWeights(key, hand);
  const freq = actual === "raise" ? w.r : actual === "call" ? w.c : w.f;
  return { ok: freq >= FREQ_OK, w };
}

function evalDecisions(h, hc) {
  const out = [];
  const [spot, opener, action] = preflopSpot(h);
  if (spot === "rfi" && h.pos && h.pos !== "BB") {
    const key = "RFI " + h.pos;
    if (spotExists(key)) {
      const actualW = action === "raise" ? "raise" :
                      action === "fold" ? "fold" : "call";
      const disp = actualW === "call" ? "limp/call" : actualW;
      const { ok, w } = judge(key, hc, "rfi", actualW);
      out.push({ key, spot: "RFI", actual: disp,
                 correct: weightsLabel(w, "rfi"), ok,
                 cat: ok ? null : categorize("rfi", disp, w) });
    }
  } else if (spot === "vs_open" && opener) {
    const op = h.posOf[opener] || "";
    const key = `${h.pos} vs ${op} open`;
    const actualW = { raise: "raise", call: "call", fold: "fold" }[action];
    if (spotExists(key) && actualW) {
      const disp = actualW === "raise" ? "3bet" : actualW;
      const { ok, w } = judge(key, hc, "vs_open", actualW);
      out.push({ key, spot: `vs ${op} open`, actual: disp,
                 correct: weightsLabel(w, "vs_open"), ok,
                 cat: ok ? null : categorize("vs_open", disp, w) });
    }
  }
  const [tb, resp] = vs3betSpot(h);
  if (tb) {
    const tp = h.posOf[tb] || "";
    const key = `${h.pos} open 被 ${tp} 3bet`;
    const actualW = { raise: "raise", call: "call", fold: "fold" }[resp];
    if (spotExists(key) && actualW) {
      const disp = actualW === "raise" ? "4bet" : actualW;
      const { ok, w } = judge(key, hc, "vs_3bet", actualW);
      out.push({ key, spot: `open 被 ${tp} 3bet`, actual: disp,
                 correct: weightsLabel(w, "vs_3bet"), ok,
                 cat: ok ? null : categorize("vs_3bet", disp, w) });
    }
  }
  return out;
}
