// ---------- import flow ----------
const drop = document.getElementById("drop");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("importStatus");

// strip replay data from preflop insta-folds stored by older builds
function compactStore(store) {
  for (const rec of Object.values(store.hands))
    if (rec.rp && rec.st && !rec.st.v && !rec.st.sf) delete rec.rp;
}

const isQuotaError = e =>
  e && (e.name === "QuotaExceededError" || /quota/i.test(e.message || ""));

async function importFiles(fileList) {
  try {
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
    compactStore(store);
    try {
      saveStore(store);
    } catch (e) {
      if (!isQuotaError(e)) throw e;
      statusEl.innerHTML = `<span class="neg">儲存失敗:瀏覽器空間已滿(localStorage 約 5MB 上限)。</span>` +
        `本次解析出 ${added} 手但無法寫入。建議:先「匯出完整備份」保存,` +
        `再清空舊手牌、只保留近期資料;或分批上傳較小的檔案。`;
      showToast("❌ 儲存失敗:瀏覽器空間已滿");
      renderAll();
      return;
    }
    const msg = `完成:新增 ${added} 手` +
      (upgraded ? `,升級 ${upgraded} 手舊資料` : "") +
      `,略過重複 ${dup} 手(檔案共 ${total} 手)`;
    statusEl.textContent = msg;
    renderAll();
    if (added || upgraded) {   // jump to the dashboard so the result is visible
      switchTab("overview");
      window.scrollTo({ top: 0 });
      showToast("✅ " + msg);
    } else if (total) {
      showToast("ℹ️ 沒有新資料:" + msg);
    } else {
      statusEl.innerHTML = `<span class="neg">檔案裡沒有解析到任何手牌——` +
        `請確認是 Natural8/GG 匯出的手牌紀錄 .zip 或 .txt。</span>`;
    }
  } catch (e) {
    statusEl.innerHTML = `<span class="neg">上傳失敗:${esc(e.message)}</span>`;
    showToast("❌ 上傳失敗:" + e.message);
  }
}

let toastTimer = null;
function showToast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 5000);
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
