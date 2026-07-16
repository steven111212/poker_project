const RANKS = "AKQJT98765432";
const STORE_KEY = "poker_hands_v2", GOAL_KEY = "poker_goal_v1",
      RANGE_KEY = "poker_ranges_v1", NOTES_KEY = "poker_notes_v1",
      DIARY_KEY = "poker_diary_v1";
const FREQ_OK = 20; // action weight (%) required to count as correct
const POSN = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

// all recognizable spots (defaults may not exist for all -> user can create)
const ALL_SPOTS = [];
["UTG","HJ","CO","BTN","SB"].forEach(p => ALL_SPOTS.push("RFI " + p));
for (let i = 0; i < 6; i++) for (let j = 0; j < i; j++)
  ALL_SPOTS.push(`${POSN[i]} vs ${POSN[j]} open`);
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 6; j++)
  ALL_SPOTS.push(`${POSN[i]} open 被 ${POSN[j]} 3bet`);

function allClasses() {
  const out = [];
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++)
    out.push(i === j ? RANKS[i] + RANKS[j] :
      (i < j ? RANKS[i] + RANKS[j] + "s" : RANKS[j] + RANKS[i] + "o"));
  return out;
}
const CLASSES = allClasses();
