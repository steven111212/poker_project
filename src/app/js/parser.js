// ---------- hand parsing ----------
const POS_BY_COUNT = { 2: ["BB", "SB"], 3: ["SB", "BB", "BTN"],
  4: ["SB", "BB", "CO", "BTN"], 5: ["SB", "BB", "HJ", "CO", "BTN"],
  6: ["SB", "BB", "UTG", "HJ", "CO", "BTN"] };

function classify(c1, c2) {
  let [r1, s1] = c1, [r2, s2] = c2;
  if (RANKS.indexOf(r1) > RANKS.indexOf(r2)) { [r1, r2] = [r2, r1]; [s1, s2] = [s2, s1]; }
  return r1 === r2 ? r1 + r2 : r1 + r2 + (s1 === s2 ? "s" : "o");
}

function parseHand(chunk) {
  const lines = chunk.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const hd = lines[0].match(/^Poker Hand #(\S+): Hold'em No Limit \(\$([\d.]+)\/\$([\d.]+)\) - (.+)$/);
  if (!hd) return null;
  const h = { id: hd[1], sb: +hd[2], bb: +hd[3], ts: hd[4], seats: {},
              button: null, cards: null, actions: [], collected: 0,
              uncalled: 0, invested: {}, rake: 0, showdown: false,
              stacksOf: {}, board: [], pots: [], shown: {}, totalPot: 0 };
  let street = "preflop", sc = {}, pot = 0;
  const markers = { "*** FLOP ***": "flop", "*** TURN ***": "turn",
                    "*** RIVER ***": "river", "*** SHOWDOWN ***": "showdown",
                    "*** SUMMARY ***": "summary" };
  for (const line of lines.slice(1)) {
    const mk = Object.keys(markers).find(k => line.startsWith(k));
    if (mk) {
      street = markers[mk]; sc = {};
      let bc;
      if (street === "flop" && (bc = line.match(/\[(\w\w) (\w\w) (\w\w)\]/)))
        h.board = [bc[1], bc[2], bc[3]];
      else if ((street === "turn" || street === "river") &&
               (bc = line.match(/\[(\w\w)\]\s*$/)))
        h.board.push(bc[1]);
      if (["flop", "turn", "river"].includes(street))
        h.pots.push(Math.round(pot * 100) / 100);
      continue;
    }
    if (street === "summary") {
      const rk = line.match(/^Total pot \$([\d.]+) \| Rake \$([\d.]+) \| Jackpot \$([\d.]+)/);
      if (rk) { h.totalPot = +rk[1]; h.rake = +rk[2] + +rk[3]; }
      continue;
    }
    let m;
    if ((m = line.match(/Seat #(\d+) is the button/))) { h.button = +m[1]; continue; }
    if ((m = line.match(/^Seat (\d+): (\S+) \(\$([\d.]+) in chips\)/))) {
      h.seats[+m[1]] = m[2]; h.stacksOf[m[2]] = +m[3]; continue; }
    if ((m = line.match(/^Dealt to Hero \[(\w\w) (\w\w)\]/))) {
      h.cards = [m[1], m[2]]; continue; }
    if ((m = line.match(/^(\S+) collected \$([\d.]+) from pot/))) {
      if (m[1] === "Hero") h.collected += +m[2]; continue; }
    if ((m = line.match(/Uncalled bet \(\$([\d.]+)\) returned to (\S+)/))) {
      if (m[2] === "Hero") h.uncalled += +m[1]; continue; }
    if (street === "showdown") {
      // real showdown = someone reveals or mucks (GG prints the marker even
      // when everyone folds, so the marker alone is not enough)
      if ((m = line.match(/^(\S+): shows \[(\w\w) (\w\w)\]/))) {
        h.showdown = true; h.shown[m[1]] = [m[2], m[3]];
        if (m[1] === "Hero") h.heroSD = true;
      } else if ((m = line.match(/^(\S+): mucks/))) {
        h.showdown = true; if (m[1] === "Hero") h.heroSD = true;
      }
      continue;
    }
    if (!["preflop", "flop", "turn", "river"].includes(street)) continue;
    m = line.match(/^(\S+): (folds|checks|calls \$([\d.]+)|bets \$([\d.]+)|raises \$[\d.]+ to \$([\d.]+)|posts small blind \$([\d.]+)|posts big blind \$([\d.]+))( and is all-in)?$/);
    if (!m) continue;
    const p = m[1];
    let kind, newTotal, prev = sc[p] || 0;
    if (m[2] === "folds") { kind = "fold"; newTotal = prev; }
    else if (m[2] === "checks") { kind = "check"; newTotal = prev; }
    else if (m[3] !== undefined) { kind = "call"; newTotal = prev + +m[3]; }
    else if (m[4] !== undefined) { kind = "bet"; newTotal = prev + +m[4]; }
    else if (m[5] !== undefined) { kind = "raise"; newTotal = +m[5]; }
    else if (m[6] !== undefined) { kind = "post_sb"; newTotal = prev + +m[6]; }
    else { kind = "post_bb"; newTotal = prev + +m[7]; }
    sc[p] = newTotal;
    h.invested[p] = (h.invested[p] || 0) + (newTotal - prev);
    pot += newTotal - prev;
    // amt: raise = "to" total, call/bet/posts = chips added, fold/check = 0
    const amt = kind === "raise" ? newTotal :
                kind === "fold" || kind === "check" ? 0 : newTotal - prev;
    h.actions.push({ street, p, kind, amt: Math.round(amt * 100) / 100 });
  }
  h.posOf = {};
  const nums = Object.keys(h.seats).map(Number).sort((a, b) => a - b);
  if (h.button !== null && nums.includes(h.button)) {
    const idx = nums.indexOf(h.button);
    const ordered = nums.slice(idx + 1).concat(nums.slice(0, idx + 1));
    const names = POS_BY_COUNT[ordered.length] || POS_BY_COUNT[6];
    ordered.forEach((s, k) => { h.posOf[h.seats[s]] = names[k]; });
  }
  h.pos = h.posOf["Hero"] || "";
  h.net = h.collected - (h.invested["Hero"] || 0) + h.uncalled;
  return h;
}

function parseText(text) {
  return text.split(/\r?\n\s*\r?\n(?=Poker Hand #)/).map(parseHand).filter(Boolean);
}
