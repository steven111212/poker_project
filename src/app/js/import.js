// ---------- import flow ----------
const drop = document.getElementById("drop");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("importStatus");

async function importFiles(fileList) {
  const store = loadStore();
  let added = 0, dup = 0, total = 0, upgraded = 0;
  for (const f of fileList) {
    let texts = [];
    try {
      if (f.name.toLowerCase().endsWith(".zip"))
        texts = (await readZip(await f.arrayBuffer())).map(x => x.text);
      else texts = [await f.text()];
    } catch (e) { statusEl.textContent = `讀取 ${f.name} 失敗:${e.message}`; continue; }
    for (const text of texts) {
      for (const h of parseText(text)) {
        total++;
        if (!h.cards || !h.pos) continue;
        const existing = store.hands[h.id];
        if (existing && existing.st && existing.st.ver === ST_VER) { dup++; continue; }
        store.hands[h.id] = storedRecord(h);
        existing ? upgraded++ : added++;
      }
    }
  }
  saveStore(store);
  statusEl.textContent = `完成:新增 ${added} 手` +
    (upgraded ? `,升級 ${upgraded} 手舊資料(補上 HUD 統計)` : "") +
    `,略過重複 ${dup} 手(檔案共 ${total} 手)`;
  renderAll();
}

drop.onclick = () => fileInput.click();
drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
drop.ondragleave = () => drop.classList.remove("over");
drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over");
                     importFiles(e.dataTransfer.files); };
fileInput.onchange = () => { importFiles(fileInput.files); fileInput.value = ""; };
document.getElementById("clearBtn").onclick = () => {
  if (confirm("確定要清空所有已上傳的手牌資料?此動作無法復原。")) {
    localStorage.removeItem(STORE_KEY); renderAll();
  }
};
