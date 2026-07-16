// ---------- range editor ----------
const spotSel = document.getElementById("spotSel");
const showErr = document.getElementById("showErr");
const editMode = document.getElementById("editMode");
const brushSel = document.getElementById("brushSel");
const mixInputs = document.getElementById("mixInputs");

function refreshSpotOptions() {
  const cust = loadCustom();
  const cur = spotSel.value;
  spotSel.innerHTML = ALL_SPOTS.map(k => {
    let tag = "";
    if (cust[k] && Object.keys(cust[k]).length) tag = "(自訂)";
    else if (!DEFAULTS[k]) tag = "(未設定)";
    return `<option value="${k}">${k} ${tag}</option>`;
  }).join("");
  spotSel.value = cur && ALL_SPOTS.includes(cur) ? cur : ALL_SPOTS[0];
}

function brushWeights() {
  const b = brushSel.value;
  if (b === "r") return { r: 100, c: 0, f: 0 };
  if (b === "c") return { r: 0, c: 100, f: 0 };
  if (b === "f") return { r: 0, c: 0, f: 100 };
  if (b === "mix") {
    let r = Math.max(0, Math.min(100, +document.getElementById("mixR").value || 0));
    let c = Math.max(0, Math.min(100 - r, +document.getElementById("mixC").value || 0));
    return { r, c, f: 100 - r - c };
  }
  return null; // reset
}

function paintCell(hand) {
  const key = spotSel.value;
  const cust = loadCustom();
  const bw = brushWeights();
  if (bw === null) {
    if (cust[key]) { delete cust[key][hand];
      if (!Object.keys(cust[key]).length) delete cust[key]; }
  } else {
    (cust[key] = cust[key] || {})[hand] = bw;
  }
  saveCustom(cust);
  renderAll();
}

brushSel.onchange = () =>
  mixInputs.classList.toggle("hidden", brushSel.value !== "mix");
editMode.onchange = () => {
  document.getElementById("editorBar").classList.toggle("hidden", !editMode.checked);
  document.getElementById("rangeGrid").classList.toggle("editing", editMode.checked);
  refreshSpotOptions();
};
document.getElementById("resetTable").onclick = () => {
  const key = spotSel.value;
  if (!confirm(`把「${key}」的自訂內容全部清除、回到預設?`)) return;
  const cust = loadCustom(); delete cust[key]; saveCustom(cust); renderAll();
};
document.getElementById("exportRanges").onclick = () => {
  const blob = new Blob([JSON.stringify(loadCustom(), null, 1)],
                        { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "my_ranges.json"; a.click();
  URL.revokeObjectURL(a.href);
};
document.getElementById("importRangesBtn").onclick = () =>
  document.getElementById("importRanges").click();
document.getElementById("importRanges").onchange = async e => {
  try {
    const obj = JSON.parse(await e.target.files[0].text());
    saveCustom(obj); renderAll();
  } catch { alert("匯入失敗:不是有效的範圍 JSON"); }
  e.target.value = "";
};
