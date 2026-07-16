// ---------- hand notes ----------
let editingNoteId = null;
const noteEditor = document.getElementById("noteEditor");
const noteLabel = (notes, id) => notes[id] ? "📝 筆記" : "＋筆記";

function noteTitleOf(id) {
  const rec = loadStore().hands[id];
  if (!rec) return `Hand #${id}`;
  const bb = Math.round(rec.net / rec.bb * 10) / 10;
  return `${rec.date} · ${rec.hc} · ${rec.pos} · ` +
         `${bb >= 0 ? "+" : ""}${bb}bb · #${id}`;
}

function openNoteEditor(id) {
  const n = loadNotes()[id] || { text: "", tags: [] };
  editingNoteId = id;
  switchTab("journal");
  noteEditor.classList.remove("hidden");
  document.getElementById("noteTitle").textContent = noteTitleOf(id);
  document.getElementById("noteText").value = n.text;
  document.getElementById("noteTags").value = (n.tags || []).join(", ");
  noteEditor.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("noteText").focus();
}

document.getElementById("noteSave").onclick = () => {
  if (!editingNoteId) return;
  const text = document.getElementById("noteText").value.trim();
  const tags = document.getElementById("noteTags").value
    .split(/[,,]/).map(t => t.trim().replace(/^#/, "")).filter(Boolean);
  const notes = loadNotes();
  if (!text && !tags.length) delete notes[editingNoteId];
  else notes[editingNoteId] = { text, tags,
    updated: new Date().toISOString().slice(0, 10) };
  saveNotes(notes);
  noteEditor.classList.add("hidden"); editingNoteId = null;
  renderAll();
};
document.getElementById("noteCancel").onclick = () => {
  noteEditor.classList.add("hidden"); editingNoteId = null;
};
document.getElementById("noteDelete").onclick = () => {
  if (!editingNoteId) return;
  const notes = loadNotes(); delete notes[editingNoteId]; saveNotes(notes);
  noteEditor.classList.add("hidden"); editingNoteId = null;
  renderAll();
};

function wireNoteButtons(root) {
  root.querySelectorAll("button[data-note]").forEach(b => {
    b.onclick = () => openNoteEditor(b.dataset.note);
  });
}

function renderNotes() {
  const notes = loadNotes();
  const store = loadStore();
  const list = document.getElementById("notesList");
  const ids = Object.keys(notes).sort((a, b) => {
    const da = store.hands[a]?.date || "", db = store.hands[b]?.date || "";
    return da < db ? 1 : da > db ? -1 : (a < b ? 1 : -1);
  });
  if (!ids.length) {
    list.innerHTML = `<p class="note">在熱力圖詳情或偏差清單點「＋筆記」,幫任何一手牌寫下檢討。</p>`;
    return;
  }
  list.innerHTML = ids.map(id => {
    const n = notes[id];
    const tags = (n.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join("");
    return `<div class="entry"><b>${esc(noteTitleOf(id))}</b>
      <span class="note" style="float:right;">${esc(n.updated || "")}</span>
      <div style="margin-top:4px;">${tags}</div>
      <div class="body">${esc(n.text)}</div>
      <div class="controls" style="margin:10px 0 0;">
        <button class="mini ghost" data-note="${esc(id)}">編輯</button>
      </div></div>`;
  }).join("");
  wireNoteButtons(list);
}
