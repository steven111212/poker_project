// ---------- AI hand analysis (DeepSeek, user-supplied key) ----------
const AI_CFG_KEY = "poker_ai_v1";
function loadAI() { return loadJSON(AI_CFG_KEY, { key: "", model: "deepseek-chat" }); }
function saveAI(a) { localStorage.setItem(AI_CFG_KEY, JSON.stringify(a)); }

// compact text dump of one range table (non-fold hands only)
function aiRangeContext(key, hand) {
  if (!spotExists(key)) return "";
  const rows = [];
  for (const name of CLASSES) {
    const w = cellWeights(key, name);
    const wa = w.a || 0;
    if (!w.r && !w.c && !wa) continue;
    const parts = [];
    if (w.r) parts.push(`r${w.r}`);
    if (wa) parts.push(`allin${wa}`);
    if (w.c) parts.push(`c${w.c}`);
    rows.push(`${name}(${parts.join("/")})`);
  }
  const w = cellWeights(key, hand);
  return `【${key}】我這手 ${hand} 的基準頻率:raise ${w.r}% / call ${w.c}%` +
    `${w.a ? ` / allin ${w.a}%` : ""} / fold ${w.f}%\n` +
    `該情境完整基準範圍(r=raise c=call/limp 數字=頻率%,未列出的牌=100%棄牌):\n` +
    rows.join(" ") + "\n";
}

const AI_ST_NAME = { p: "翻前", f: "翻牌", t: "轉牌", r: "河牌" };
const AI_SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" };
const aiCard = c => c[0] + AI_SUIT[c[1]];

// precomputed suit facts so the model cannot hallucinate flushes
function aiSuitFacts(rp) {
  if (!rp.b.length) return "";
  const cnt = { s: 0, h: 0, d: 0, c: 0 };
  rp.b.forEach(c => cnt[c[1]]++);
  const boardTxt = Object.entries(cnt).filter(([, n]) => n)
    .map(([k, n]) => `${AI_SUIT[k]} ${n}張`).join("、");
  const [c1, c2] = rp.hc;
  let mine;
  if (c1[1] === c2[1]) {
    const n = cnt[c1[1]];
    mine = `我的兩張手牌同為${AI_SUIT[c1[1]]},牌面${AI_SUIT[c1[1]]}共 ${n} 張` +
      `(手牌+牌面合計 ${n + 2} 張)→ 我${n >= 3 ? "有" : "【沒有】"}同花`;
  } else {
    const n1 = cnt[c1[1]], n2 = cnt[c2[1]];
    mine = `我的兩張手牌花色不同(${AI_SUIT[c1[1]]} 與 ${AI_SUIT[c2[1]]})` +
      `→ 我${(n1 >= 4 || n2 >= 4) ? "有" : "【沒有】"}同花`;
  }
  const bd = Object.entries(cnt).find(([, n]) => n >= 3);
  return `花色事實(程式計算,絕對正確;分析涉及同花時必須以此為準):` +
    `牌面花色 ${boardTxt};${mine}` +
    `${bd ? `;牌面${AI_SUIT[bd[0]]}有 ${bd[1]} 張,對手可能持有${AI_SUIT[bd[0]]}同花` : ";牌面無三張同花色,任何人都不可能成同花"}。\n`;
}
const AI_KIND = { fold: "棄牌", check: "過牌", call: "跟注", bet: "下注",
                  raise: "加注到", post_sb: "小盲", post_bb: "大盲" };

function buildHandPrompt(rec) {
  const rp = rec.rp;
  const bbAmt = Math.round(rec.net / rec.bb * 10) / 10;
  const stacks = Object.entries(rp.stk)
    .map(([p, v]) => `${p} $${v}(${Math.round(v / rec.bb)}bb)`).join("、");
  const acts = rp.a.map(([st, p, k, amt]) =>
    `${AI_ST_NAME[st]}:${p}${p === rec.pos ? "(我)" : ""} ` +
    `${AI_KIND[k] || k}${amt ? ` $${amt}` : ""}`).join("\n");
  const pots = rp.pots.map((v, i) =>
    `${["翻牌", "轉牌", "河牌"][i]}開始時底池 $${v}`).join("、");

  const ranges = [];
  const [spot, openerPos] = rec.pf;
  if (spot === "rfi" && rec.pos && rec.pos !== "BB")
    ranges.push(aiRangeContext("RFI " + rec.pos, rec.hc));
  else if (spot === "vs_open" && openerPos)
    ranges.push(aiRangeContext(`${rec.pos} vs ${openerPos} open`, rec.hc));
  if (rec.tb && rec.tb[0])
    ranges.push(aiRangeContext(`${rec.pos} open 被 ${rec.tb[0]} 3bet`, rec.hc));

  return `你是一位專業德州撲克教練。請用繁體中文分析下面這手 6-max 現金桌牌局。

規則與期望:
1. 嚴禁結果導向:輸大底池不代表打錯,贏也不代表打對。只依據決策當下的資訊評估。
2. 逐街分析(翻前→翻牌→轉牌→河牌),每street指出我的決策是否合理,依據範圍互動、位置、底池賠率、SPR、阻斷牌等邏輯。
3. 翻前請對照我提供的基準範圍表判斷;翻後沒有基準表,請用範圍推理。
4. 指出 1~3 個最關鍵的決策點,如果有更好的替代打法請說明並解釋原因;打得好的地方也要肯定。
5. 最後給一段 2~3 句的總結。全文控制在 500 字以內,直接講重點。
6. 成牌判讀必須以下方「花色事實」為準——那是程式算好的,絕對正確。若你的推理與它衝突,是你看錯牌,請重新核對。禁止聲稱不存在的同花/順子/葫蘆。

=== 牌局資料(NL${Math.round(rec.bb * 100)},盲注 $${rec.bb / 2}/$${rec.bb}) ===
我的位置:${rec.pos},手牌:${rp.hc.map(aiCard).join(" ")}(${rec.hc})
起始籌碼:${stacks}
公共牌:${rp.b.length
    ? `翻牌 ${rp.b.slice(0, 3).map(aiCard).join(" ")}` +
      (rp.b[3] ? ` / 轉牌 ${aiCard(rp.b[3])}` : "") +
      (rp.b[4] ? ` / 河牌 ${aiCard(rp.b[4])}` : "")
    : "(未見翻牌)"}
${aiSuitFacts(rp)}${pots ? pots + "\n" : ""}動作順序:
${acts}
結果:我${bbAmt >= 0 ? "贏" : "輸"} ${Math.abs(bbAmt)} bb${rp.tp ? `,總底池 $${rp.tp}` : ""}
${Object.keys(rp.sh).length ? "攤牌:" + Object.entries(rp.sh).map(([p, c]) => `${p} 亮出 ${c.join(" ")}`).join("、") : ""}

=== 我方使用的翻前基準範圍 ===
${ranges.filter(Boolean).join("\n") || "(此手無對應的翻前基準表)"}`;
}

async function askAI(prompt, outEl) {
  const ai = loadAI();
  if (!ai.key) {
    outEl.innerHTML = `<span class="note">尚未設定 API key——到「📂 資料」分頁的 AI 設定貼上 DeepSeek key;` +
      `或按「複製提示詞」貼到任何 AI 聊天視窗。</span>`;
    return;
  }
  outEl.textContent = "🤖 AI 分析中,約需 10–30 秒…";
  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json",
                 "Authorization": "Bearer " + ai.key },
      body: JSON.stringify({
        model: ai.model || "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 150)}`);
    const d = await r.json();
    outEl.textContent = d.choices[0].message.content;
  } catch (e) {
    outEl.innerHTML = `<span class="neg">呼叫失敗:${esc(e.message)}</span><br>` +
      `<span class="note">可改按「複製提示詞」,貼到 DeepSeek / ChatGPT 網頁版分析。</span>`;
  }
}

// replay-modal buttons
document.getElementById("rpAI").onclick = () => {
  if (!rpOpenId) return;
  const rec = loadStore().hands[rpOpenId];
  if (!rec || !rec.rp) return;
  askAI(buildHandPrompt(rec), document.getElementById("rpAIout"));
};

// settings UI (data tab)
const aiKeyInput = document.getElementById("aiKey");
const aiModelInput = document.getElementById("aiModel");
{
  const ai = loadAI();
  aiKeyInput.value = ai.key || "";
  aiModelInput.value = ai.model || "deepseek-chat";
}
document.getElementById("aiSave").onclick = () => {
  saveAI({ key: aiKeyInput.value.trim(),
           model: aiModelInput.value.trim() || "deepseek-chat" });
  document.getElementById("aiMsg").textContent = "已儲存 ✓(只存在此瀏覽器)";
};
