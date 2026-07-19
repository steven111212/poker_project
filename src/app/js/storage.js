// ---------- storage ----------
const loadJSON = (k, dflt) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? dflt; } catch { return dflt; }
};
function loadStore() { return loadJSON(STORE_KEY, { hands: {} }); }
function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
function loadGoal() { return loadJSON(GOAL_KEY, { bb: 0.1, target: 500 }); }
function loadCustom() { return loadJSON(RANGE_KEY, {}); }
function saveCustom(c) { localStorage.setItem(RANGE_KEY, JSON.stringify(c)); }
function loadNotes() { return loadJSON(NOTES_KEY, {}); }
function saveNotes(n) { localStorage.setItem(NOTES_KEY, JSON.stringify(n)); }
function loadDiary() { return loadJSON(DIARY_KEY, {}); }
function saveDiary(d) { localStorage.setItem(DIARY_KEY, JSON.stringify(d)); }
const UI_KEY = "poker_ui_v1";
function saveUI(patch) {   // merge, so tab / unit prefs don't clobber each other
  localStorage.setItem(UI_KEY,
    JSON.stringify({ ...loadJSON(UI_KEY, {}), ...patch }));
}
const esc = s => String(s).replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const FOLD100 = { r: 0, c: 0, f: 100 };
function cellWeights(key, hand) {
  const cust = loadCustom();
  if (cust[key] && cust[key][hand]) return cust[key][hand];
  return (DEFAULTS[key] && DEFAULTS[key][hand]) || FOLD100;
}
function spotExists(key) {
  return !!DEFAULTS[key] || !!loadCustom()[key];
}
