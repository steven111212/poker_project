// ---------- tabs ----------
function switchTab(name) {
  document.querySelectorAll("#tabs button").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll("[data-pane]").forEach(el =>
    el.classList.toggle("pane-active", el.dataset.pane === name));
  saveUI({ tab: name });
}
document.querySelectorAll("#tabs button").forEach(b => {
  b.onclick = () => { switchTab(b.dataset.tab); window.scrollTo({ top: 0 }); };
});

renderAll();
const savedTab = loadJSON(UI_KEY, {}).tab;
const validTabs = ["overview", "review", "journal", "data"];
switchTab(validTabs.includes(savedTab) ? savedTab :
  (Object.keys(loadStore().hands).length ? "overview" : "data"));
