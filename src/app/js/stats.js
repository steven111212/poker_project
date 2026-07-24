// ---------- HUD stat flags (computed once at import, stored per hand) ----------
function statFlags(h) {
  const pre = h.actions.filter(a => a.street === "preflop");
  const post = h.actions.filter(a =>
    ["flop", "turn", "river"].includes(a.street));
  const heroPre = pre.filter(a => a.p === "Hero");
  const v = heroPre.some(a => a.kind === "call" || a.kind === "raise") ? 1 : 0;
  const p = heroPre.some(a => a.kind === "raise") ? 1 : 0;

  // 3-bet & steal opportunities: walk preflop in order
  const raisers = [];
  let othersEntered = false, heroActed = false;
  let t3 = [0, 0], ats = [0, 0];
  for (const a of pre) {
    if (a.kind === "post_sb" || a.kind === "post_bb") continue;
    if (a.p === "Hero") {
      if (raisers.length === 1 && raisers[0] !== "Hero" && !t3[0]) {
        t3 = [1, a.kind === "raise" ? 1 : 0];
      }
      if (!heroActed && !raisers.length && !othersEntered &&
          ["CO", "BTN", "SB"].includes(h.pos)) {
        ats = [1, a.kind === "raise" ? 1 : 0];
      }
      heroActed = true;
    } else if (a.kind === "call") othersEntered = true;
    if (a.kind === "raise") raisers.push(a.p);
  }

  const heroFoldedPre = heroPre.some(a => a.kind === "fold");
  const sf = (!heroFoldedPre && (post.length > 0 || h.showdown)) ? 1 : 0;
  const wt = (sf && h.heroSD) ? 1 : 0;   // hero actually showed or mucked
  const wsd = (wt && h.collected > 0) ? 1 : 0;

  // postflop aggression: [bets+raises, passive actions (call/check/fold)]
  const heroPost = post.filter(a => a.p === "Hero");
  const ag = [heroPost.filter(a => a.kind === "bet" || a.kind === "raise").length,
              heroPost.filter(a => ["call", "check", "fold"].includes(a.kind)).length];

  // c-bet lines on flop/turn (index 0/1); simplified, aggressor must keep betting
  const aggr = [...pre].reverse().find(a => a.kind === "raise")?.p || null;
  const cb = [[0, 0], [0, 0]];            // [opportunity, did] hero as aggressor
  const fcb = [[0, 0, 0, 0], [0, 0, 0, 0]]; // [opp, fold, call, raise] facing c-bet
  if (aggr) {
    for (let si = 0; si < 2; si++) {
      const acts = h.actions.filter(a => a.street === ["flop", "turn"][si]);
      if (!acts.length) break;
      let betSeen = false, aggrBet = false, heroResponded = false;
      for (const a of acts) {
        if (a.p === "Hero") {
          if (aggr === "Hero") {
            if (!betSeen && !cb[si][0]) {
              cb[si][0] = 1; if (a.kind === "bet") { cb[si][1] = 1; }
            }
          } else if (betSeen && !heroResponded) {
            fcb[si][0] = 1;
            if (a.kind === "fold") fcb[si][1] = 1;
            else if (a.kind === "call") fcb[si][2] = 1;
            else if (a.kind === "raise") fcb[si][3] = 1;
            heroResponded = true;
          }
        }
        if (a.kind === "bet") { betSeen = true; if (a.p === aggr) aggrBet = true; }
      }
      if (!aggrBet) break; // no continuation -> next street isn't a c-bet spot
    }
  }
  return { ver: 3, v, p, t3, ats, sf, wt, wsd, ag, cb, fcb };
}
const ST_VER = 3;

// compact replay payload: seats/stacks, board, per-action amounts, showdown
function replayData(h) {
  const posOf = n => h.posOf[n] || n;
  const stk = {};
  for (const [n, v] of Object.entries(h.stacksOf)) stk[posOf(n)] = v;
  const sh = {};
  for (const [n, c] of Object.entries(h.shown)) sh[posOf(n)] = c;
  return {
    stk, sh,
    hc: h.cards,                       // hero's exact cards
    b: h.board, pots: h.pots, tp: h.totalPot,
    a: h.actions.map(a => [a.street[0], posOf(a.p), a.kind, a.amt]),
  };
}

// hands are stored raw-ish so ranges can be re-evaluated after edits.
// replay data (rp) is kept only for hands hero actually played — preflop
// insta-folds have no review value and would blow the localStorage quota.
function storedRecord(h) {
  const rec = storedRecordBase(h);
  if (rec.st.v || rec.st.sf) rec.rp = replayData(h);
  return rec;
}

function storedRecordBase(h) {
  const hc = classify(h.cards[0], h.cards[1]);
  const [spot, opener, action] = preflopSpot(h);
  const [tb, resp] = vs3betSpot(h);
  return { id: h.id, date: h.ts.slice(0, 10), bb: h.bb, pos: h.pos, hc,
           net: Math.round(h.net * 100) / 100,
           rk: h.collected > 0 ? Math.round(h.rake * 100) / 100 : 0,
           pf: [spot, opener ? (h.posOf[opener] || "") : null, action],
           tb: [tb ? (h.posOf[tb] || "") : null, resp],
           st: statFlags(h) };
}

function decisionsOf(rec) {
  // rebuild a minimal hand-like object for evalDecisions
  const fake = {
    pos: rec.pos, posOf: {},
    actions: [],
  };
  // shortcut: evaluate directly from stored spot info
  const out = [];
  const [spot, openerPos, action] = rec.pf;
  if (spot === "rfi" && rec.pos && rec.pos !== "BB") {
    const key = "RFI " + rec.pos;
    if (spotExists(key)) {
      const actualW = action === "raise" ? "raise" :
                      action === "fold" ? "fold" : "call";
      const disp = actualW === "call" ? "limp/call" : actualW;
      const { ok, w } = judge(key, rec.hc, "rfi", actualW);
      out.push({ key, spot: "RFI", actual: disp,
                 correct: weightsLabel(w, "rfi"), ok,
                 cat: ok ? null : categorize("rfi", disp, w) });
    }
  } else if (spot === "vs_open" && openerPos) {
    const key = `${rec.pos} vs ${openerPos} open`;
    const actualW = { raise: "raise", call: "call", fold: "fold" }[action];
    if (spotExists(key) && actualW) {
      const disp = actualW === "raise" ? "3bet" : actualW;
      const { ok, w } = judge(key, rec.hc, "vs_open", actualW);
      out.push({ key, spot: `vs ${openerPos} open`, actual: disp,
                 correct: weightsLabel(w, "vs_open"), ok,
                 cat: ok ? null : categorize("vs_open", disp, w) });
    }
  }
  const [tbPos, resp] = rec.tb;
  if (tbPos) {
    const key = `${rec.pos} open 被 ${tbPos} 3bet`;
    const actualW = { raise: "raise", call: "call", fold: "fold" }[resp];
    if (spotExists(key) && actualW) {
      const disp = actualW === "raise" ? "4bet" : actualW;
      const { ok, w } = judge(key, rec.hc, "vs_3bet", actualW);
      out.push({ key, spot: `open 被 ${tbPos} 3bet`, actual: disp,
                 correct: weightsLabel(w, "vs_3bet"), ok,
                 cat: ok ? null : categorize("vs_3bet", disp, w) });
    }
  }
  return out;
}
