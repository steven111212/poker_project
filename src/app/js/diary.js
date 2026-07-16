// ---------- session diary ----------
const diaryDate = document.getElementById("diaryDate");

function diaryStatsOf(date, rows) {
  const s = rows.find(r => r.date === date);
  return s ? `${s.hands} 手 · ${s.net_bb >= 0 ? "+" : ""}${s.net_bb} bb · ` +
             `bb/100 ${s.bb100 >= 0 ? "+" : ""}${s.bb100} · 偏差率 ${s.rate}%`
           : "(此日期無手牌資料)";
}

function loadDiaryEntry() {
  const rows = (window._D || computeData()).rows;
  const d = diaryDate.value;
  document.getElementById("diaryStats").textContent = d ? diaryStatsOf(d, rows) : "";
  document.getElementById("diaryText").value = d ? (loadDiary()[d]?.text || "") : "";
  document.getElementById("diaryMsg").textContent = "";
}
diaryDate.onchange = loadDiaryEntry;

document.getElementById("diarySave").onclick = () => {
  const d = diaryDate.value;
  if (!d) return;
  const text = document.getElementById("diaryText").value.trim();
  const diary = loadDiary();
  if (!text) delete diary[d];
  else diary[d] = { text, updated: new Date().toISOString().slice(0, 10) };
  saveDiary(diary);
  document.getElementById("diaryMsg").textContent = "已儲存 ✓";
  renderJournal(window._D || computeData());
};

function renderJournal(D) {
  const diary = loadDiary();
  const dates = [...new Set(D.rows.map(r => r.date).concat(Object.keys(diary)))]
    .sort().reverse();
  const cur = diaryDate.value;
  diaryDate.innerHTML = dates.map(d =>
    `<option value="${d}">${d}${diary[d] ? " 📝" : ""}</option>`).join("");
  if (cur && dates.includes(cur)) diaryDate.value = cur;
  loadDiaryEntry();

  const list = document.getElementById("diaryList");
  const entries = Object.keys(diary).sort().reverse();
  list.innerHTML = entries.map(d =>
    `<div class="entry"><b>${esc(d)}</b>
      <span class="note" style="margin-left:10px;">${esc(diaryStatsOf(d, D.rows))}</span>
      <div class="body">${esc(diary[d].text)}</div></div>`).join("")
    || `<p class="note">還沒有日記。打完一個 session,回來寫下當天的狀態與檢討,系統會把數據和心得放在一起。</p>`;
}
