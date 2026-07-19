// ---------- preflop trainer ----------
let prMode = "random", prCur = null, prAnswered = false;
let prScore = { ok: 0, tot: 0 };
const prQ = document.getElementById("prQ");
const prHand = document.getElementById("prHand");
const prActions = document.getElementById("prActions");
const prFeedback = document.getElementById("prFeedback");
const prJumpBtn = document.getElementById("prJump");

const combosOfClass = n => n.length === 2 ? 6 : (n[2] === "s" ? 4 : 12);

function weakPool() {
  const D = window._D || computeData();
  const seen = new Set(), pool = [];
  for (const m of D.mistakes) {
    const k = m.key + "|" + m.hand;
    if (!seen.has(k)) { seen.add(k); pool.push({ key: m.key, hand: m.hand }); }
  }
  return pool;
}

function randClass() {
  let r = Math.random() * 1326;
  for (const c of CLASSES) { r -= combosOfClass(c); if (r <= 0) return c; }
  return "AA";
}

function concreteCards(cls) {
  const suits = ["s", "h", "d", "c"].sort(() => Math.random() - 0.5);
  if (cls.length === 2) return [cls[0] + suits[0], cls[1] + suits[1]];
  if (cls[2] === "s") return [cls[0] + suits[0], cls[1] + suits[0]];
  return [cls[0] + suits[0], cls[1] + suits[1]];
}

function kindOf(key) {
  if (key.startsWith("RFI ")) return "rfi";
  return key.includes(" vs ") ? "vs_open" : "vs_3bet";
}

function spotPrompt(key) {
  let m;
  if (key.startsWith("RFI "))
    return `你在 <b>${key.slice(4)}</b>,前面全部棄牌(首入),你拿:`;
  if ((m = key.match(/^(\w+) vs (\w+) open$/)))
    return `你在 <b>${m[1]}</b>,面對 <b>${m[2]}</b> 的 open,你拿:`;
  m = key.match(/^(\w+) open 被 (\w+) 3bet$/);
  return `你在 <b>${m[1]}</b> open 後被 <b>${m[2]}</b> 3-bet,你拿:`;
}

function actionSet(key) {
  const kind = kindOf(key);
  if (kind === "rfi") return [["r", "Open 加注"], ["c", "Limp"], ["f", "棄牌"]];
  if (kind === "vs_open") return [["r", "3-Bet"], ["c", "跟注"], ["f", "棄牌"]];
  return [["r", "4-Bet"], ["c", "跟注"], ["f", "棄牌"]];
}

function nextQuestion() {
  prAnswered = false;
  prFeedback.innerHTML = "";
  prJumpBtn.classList.add("hidden");
  if (prMode === "weak") {
    const pool = weakPool();
    if (!pool.length) {
      prQ.innerHTML = `<span class="note">還沒有偏差紀錄可以練——先上傳手牌,` +
        `或切回「隨機練習」。</span>`;
      prHand.innerHTML = ""; prActions.innerHTML = ""; prCur = null;
      return;
    }
    prCur = pool[Math.floor(Math.random() * pool.length)];
  } else {
    const spots = ALL_SPOTS.filter(spotExists);
    const key = spots[Math.floor(Math.random() * spots.length)];
    prCur = { key, hand: randClass() };
  }
  prQ.innerHTML = spotPrompt(prCur.key);
  prHand.innerHTML = concreteCards(prCur.hand).map(pcard).join(" ") +
    ` <span class="note" style="margin-left:8px;">${prCur.hand}</span>`;
  prActions.innerHTML = actionSet(prCur.key).map(([a, label], i) =>
    `<button class="ghost" data-act="${a}">${i + 1}. ${label}</button>`).join("");
  prActions.querySelectorAll("button").forEach(b => {
    b.onclick = () => answerQuestion(b.dataset.act);
  });
}

function answerQuestion(act) {
  if (prAnswered || !prCur) return;
  prAnswered = true;
  const w = cellWeights(prCur.key, prCur.hand);
  const freq = act === "r" ? w.r : act === "c" ? w.c : w.f;
  const ok = freq >= FREQ_OK;
  prScore.tot++; if (ok) prScore.ok++;
  const kind = kindOf(prCur.key);
  prFeedback.innerHTML = (ok
    ? `<b class="pos">✅ 正確</b>`
    : `<b class="neg">❌ 錯誤</b>`) +
    ` <span class="note">基準:${weightsLabel(w, kind)}` +
    `(選的動作權重 ${freq}%,≥${FREQ_OK}% 算對)</span>`;
  prActions.querySelectorAll("button").forEach(b => {
    const f = b.dataset.act === "r" ? w.r : b.dataset.act === "c" ? w.c : w.f;
    if (b.dataset.act === act)
      b.style.borderColor = ok ? "var(--win)" : "var(--loss)";
    if (f >= FREQ_OK) b.style.background = "var(--accent-soft)";
  });
  prJumpBtn.classList.remove("hidden");
  updatePrScore();
}

function updatePrScore() {
  document.getElementById("prScore").textContent = prScore.tot
    ? `本次:${prScore.ok} / ${prScore.tot}` +
      `(${Math.round(100 * prScore.ok / prScore.tot)}%)`
    : "";
}

document.querySelectorAll("#prMode button").forEach(b => {
  b.onclick = () => {
    prMode = b.dataset.mode;
    document.querySelectorAll("#prMode button").forEach(x =>
      x.classList.toggle("active", x === b));
    nextQuestion();
  };
});
document.getElementById("prNext").onclick = nextQuestion;
document.getElementById("prReset").onclick = () => {
  prScore = { ok: 0, tot: 0 }; updatePrScore(); nextQuestion();
};
prJumpBtn.onclick = () => {
  if (!prCur) return;
  switchTab("review");
  jumpToRange(prCur.key, prCur.hand);
};
document.addEventListener("keydown", e => {
  const active = document.querySelector('section[data-pane="practice"]');
  if (!active || !active.classList.contains("pane-active")) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "Enter") { nextQuestion(); return; }
  const idx = { "1": 0, "2": 1, "3": 2 }[e.key];
  if (idx !== undefined) {
    const btn = prActions.querySelectorAll("button")[idx];
    if (btn) btn.click();
  }
});
nextQuestion();
