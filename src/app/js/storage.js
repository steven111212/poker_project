// ---------- storage ----------
const loadJSON = (k, dflt) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? dflt; } catch { return dflt; }
};
function loadStore() { return loadJSON(STORE_KEY, { hands: {} }); }
function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
function loadGoal() { return loadJSON(GOAL_KEY, { bb: 0.1, target: 500 }); }
// range profiles: named sets of custom-range overrides (per stake / depth)
const PROF_KEY = "poker_range_profiles_v1";
function loadProfiles() {
  let p = loadJSON(PROF_KEY, null);
  if (!p || !p.profiles) {
    // migrate legacy single custom-range store into a default profile
    p = { active: "預設", profiles: { "預設": loadJSON(RANGE_KEY, {}) } };
    localStorage.setItem(PROF_KEY, JSON.stringify(p));
  }
  if (!p.profiles[p.active]) p.active = Object.keys(p.profiles)[0];
  return p;
}
function saveProfiles(p) { localStorage.setItem(PROF_KEY, JSON.stringify(p)); }
function loadCustom() {
  const p = loadProfiles(); return p.profiles[p.active] || {};
}
function saveCustom(c) {
  const p = loadProfiles(); p.profiles[p.active] = c; saveProfiles(p);
}
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
