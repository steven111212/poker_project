// ---------- full backup ----------
document.getElementById("backupBtn").onclick = () => {
  const data = { app: "poker_growth", version: 1,
    exported: new Date().toISOString(),
    hands: loadStore().hands, goal: loadGoal(), ranges: loadCustom(),
    notes: loadNotes(), diary: loadDiary() };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `poker_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
};
document.getElementById("restoreBtn").onclick = () =>
  document.getElementById("restoreFile").click();
document.getElementById("restoreFile").onchange = async e => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!data || data.app !== "poker_growth" || typeof data.hands !== "object")
      throw new Error("格式不符");
    if (!confirm(`匯入 ${data.exported ? data.exported.slice(0, 10) : "未知日期"} 的備份?` +
        `\n手牌會合併去重;筆記/日記/範圍若同一筆以備份內容為準。`)) {
      e.target.value = ""; return;
    }
    const store = loadStore();
    let added = 0;
    for (const [id, rec] of Object.entries(data.hands || {}))
      if (!store.hands[id]) { store.hands[id] = rec; added++; }
    saveStore(store);
    saveNotes({ ...loadNotes(), ...(data.notes || {}) });
    saveDiary({ ...loadDiary(), ...(data.diary || {}) });
    saveCustom({ ...loadCustom(), ...(data.ranges || {}) });
    if (data.goal) localStorage.setItem(GOAL_KEY, JSON.stringify(data.goal));
    alert(`匯入完成:新增 ${added} 手,筆記 ${Object.keys(data.notes || {}).length} 則、` +
          `日記 ${Object.keys(data.diary || {}).length} 篇已合併。`);
    renderAll();
  } catch (err) { alert("匯入失敗:" + err.message); }
  e.target.value = "";
};
