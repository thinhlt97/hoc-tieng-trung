/* ============================================================================
 * proxy/api/chinese.js — Vercel Serverless Function (vùng iad1, Mỹ)
 * ----------------------------------------------------------------------------
 * Sinh nội dung AI cho app học tiếng Trung. Phân nhánh theo `task`:
 *   - task:"example" → 2 câu ví dụ cho 1 từ.
 *   - task:"quiz"    → bộ câu hỏi trắc nghiệm BẰNG TIẾNG TRUNG ĐƠN GIẢN
 *                      (điền từ / chọn câu dùng đúng từ…) kèm giải thích tiếng Việt.
 *
 * Vì sao Vercel chứ không Cloudflare: Gemini chặn theo vị trí; Worker hay chạy
 * ở HK → 403. Vercel iad1 ở Mỹ nên không bị chặn. (Giống x-translate-proxy.)
 *
 * POST { task:"example", word, pinyin, meaning, provider:"gemini"|"groq" }
 *  ←  { examples:[ { zh, pinyin, vi } ] }
 *
 * POST { task:"quiz", words:[{w,p,vi,pos}], n:5, provider:"gemini"|"groq" }
 *  ←  { questions:[ { type, stem, stem_pinyin, stem_vi,
 *                     options:["A","B","C","D"], correct:0..3, explain, target } ] }
 *
 * POST { task:"sentences", level:"HSK1", n:5, provider:"gemini"|"groq" }
 *  ←  { sentences:[ { zh, pinyin, vi, vocab:[{ w, p, vi }] } ] }
 *
 * POST { task:"radical", char, word, pinyin, meaning, provider:"gemini"|"groq" }
 *  ←  { char, components:[ { part, name, meaning } ], mnemonic }
 *
 * POST { task:"grammar", title, formula, explain, examples:[{zh}], level:"HSK2", n:5, provider }
 *  ←  { exercises:[
 *        { type:"mc",        stem, options:[4], correct:0..3, pinyin, vi, explain },
 *        { type:"order",     segments:[...], answer, pinyin, vi, explain },
 *        { type:"translate", vi, answer, pinyin, explain } ] }
 *
 * POST { task:"hskexam", skill:"listen"|"read", level:"HSK1", n:10, provider }
 *  ←  { title, skill, level, questions:[ { passage|audio, q, options:[3-4], correct:0.. } ] }
 *      (đề NHẸ để làm; pinyin/dịch/giải thích lấy riêng bằng "hskexplain")
 * POST { task:"hskexplain", level, item:{ passage|audio, q, options, correct }, provider }
 *  ←  { pinyin, vi, explain }   // gọi khi bấm "Xem đáp án" từng câu; frontend cache lại
 *
 * Env (Vercel → Settings → Environment Variables, đổi xong phải Redeploy):
 *   GEMINI_API_KEY, GROQ_API_KEY
 *   GEMINI_PRO_API_KEY  (tùy chọn) — key Gemini trả phí cho provider "geminipro"
 *                       (nút "Dùng AI Pro" khi lỗi). Thiếu ⇒ dùng GEMINI_API_KEY.
 * ==========================================================================*/

const ALLOWED_ORIGINS = [
  "https://hoc-tieng-trung.pages.dev",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/* ---------- task: example ---------- */
const SYS_EXAMPLE = `Bạn là giáo viên tiếng Trung cho người Việt mới học (trình độ HSK1-2).
Cho 1 từ tiếng Trung, hãy tạo 2 câu ví dụ NGẮN, ĐƠN GIẢN, dùng từ vựng cơ bản.
Trả về DUY NHẤT JSON hợp lệ dạng:
{"examples":[{"zh":"câu chữ Hán giản thể","pinyin":"pinyin có dấu thanh","vi":"dịch tiếng Việt tự nhiên"}]}
Không thêm chữ nào ngoài JSON.`;

function promptExample(b) {
  return `Từ: ${b.word} (${b.pinyin || ""}) nghĩa: ${b.meaning || ""}. Tạo 2 câu ví dụ.`;
}

/* ---------- task: quiz ---------- */
const SYS_QUIZ = `Bạn là giáo viên tiếng Trung cho người Việt MỚI HỌC (trình độ HSK1-2).
Hãy soạn câu hỏi trắc nghiệm 4 phương án (A,B,C,D) để luyện DÙNG TỪ VỰNG.
YÊU CẦU QUAN TRỌNG:
- Câu hỏi (phần đề và các phương án) viết BẰNG TIẾNG TRUNG GIẢN THỂ, NGẮN và ĐƠN GIẢN,
  chỉ dùng từ vựng cơ bản (HSK1-2) ngoài từ đang kiểm tra.
- Mỗi câu hỏi xoáy vào MỘT từ trong danh sách được cho ("target").
- Trộn các DẠNG sau cho phong phú:
  * "fill"  — điền từ: phần đề là một câu có chỗ trống viết là ＿＿; 4 phương án là 4 TỪ;
              chỉ 1 từ điền vào đúng nghĩa & ngữ pháp.
  * "usage" — chọn câu dùng từ ĐÚNG: 4 phương án là 4 CÂU; chỉ 1 câu dùng từ "target" đúng cách,
              3 câu kia dùng SAI (sai ngữ pháp/ngữ nghĩa/kết hợp từ) để gây nhiễu.
  * "reply" — chọn câu đáp/câu tiếp hợp lý cho một câu nói (giao tiếp cơ bản).
- "correct" là CHỈ SỐ (0-3) của phương án đúng trong mảng "options".
- "explain" viết BẰNG TIẾNG VIỆT: nói RÕ vì sao đáp án đúng đúng, và vì sao TỪNG phương án sai lại sai.
- "stem_pinyin" = pinyin có dấu thanh của phần đề; "stem_vi" = dịch nghĩa phần đề sang tiếng Việt.
Trả về DUY NHẤT JSON hợp lệ:
{"questions":[{"type":"fill|usage|reply","stem":"...","stem_pinyin":"...","stem_vi":"...",
"options":["...","...","...","..."],"correct":0,"explain":"...","target":"汉字"}]}
Không thêm chữ nào ngoài JSON.`;

function promptQuiz(b) {
  const n = Math.min(Math.max(parseInt(b.n, 10) || 5, 1), 8);
  const list = (b.words || [])
    .map((w) => `${w.w}(${w.p || ""}=${w.vi || ""}${w.pos ? "," + w.pos : ""})`)
    .join("; ");
  return `Danh sách từ cần luyện: ${list}.
Soạn ĐÚNG ${n} câu hỏi, mỗi câu nhắm vào một từ khác nhau trong danh sách (ưu tiên đa dạng dạng câu).`;
}

/* ---------- task: sentences / zh2vi (câu tiếng Trung để người học tự dịch sang Việt) ---------- */
const SYS_SENTENCES = `Bạn là giáo viên tiếng Trung cho người Việt MỚI HỌC.
Hãy tạo các câu tiếng Trung giản thể NGẮN và ĐƠN GIẢN, ĐÚNG trình độ được yêu cầu,
chỉ dùng từ vựng và ngữ pháp cơ bản của trình độ đó. Mỗi câu nói về một tình huống
đời thường khác nhau (chào hỏi, gia đình, ăn uống, thời gian, đi lại…), KHÔNG trùng lặp.
Với mỗi câu, cung cấp:
- "zh": câu chữ Hán giản thể (có dấu câu).
- "pinyin": pinyin có dấu thanh cho cả câu.
- "vi": dịch nghĩa tiếng Việt tự nhiên.
- "vocab": danh sách các từ chính trong câu, mỗi từ gồm {"w":"chữ Hán","p":"pinyin có dấu","vi":"nghĩa tiếng Việt"}.
- "grammar": giải thích NGỮ PHÁP của câu bằng tiếng Việt (2-4 câu ngắn): cấu trúc câu,
  vị trí các thành phần, công dụng của hư từ/trợ từ (了, 的, 吗, 在…), điểm người Việt hay nhầm.
Trả về DUY NHẤT JSON hợp lệ dạng:
{"sentences":[{"zh":"...","pinyin":"...","vi":"...","vocab":[{"w":"...","p":"...","vi":"..."}],"grammar":"..."}]}
Không thêm chữ nào ngoài JSON.`;

function promptSentences(b) {
  const n = Math.min(Math.max(parseInt(b.n, 10) || 5, 1), 10);
  const level = String(b.level || "HSK1").trim() || "HSK1";
  return `Trình độ: ${level}. Soạn ĐÚNG ${n} câu khác nhau, đa dạng chủ đề đời thường.`;
}

/* ---------- task: listen (nghe cả câu rồi gõ pinyin) ----------
 * Giống "sentences" nhưng thêm "tokens": tách TỪNG chữ Hán kèm pinyin của chữ đó,
 * để frontend hiện dần chữ Hán theo các âm tiết người học gõ đúng. */
const SYS_LISTEN = `Bạn là giáo viên tiếng Trung cho người Việt MỚI HỌC.
Hãy tạo các câu tiếng Trung giản thể NGẮN, ĐƠN GIẢN, ĐÚNG trình độ được yêu cầu, dễ NGHE
(không dùng từ hiếm), mỗi câu một tình huống đời thường khác nhau, KHÔNG trùng lặp.
Với mỗi câu, cung cấp:
- "zh": câu chữ Hán giản thể (có dấu câu).
- "pinyin": pinyin có dấu thanh cho cả câu.
- "vi": dịch nghĩa tiếng Việt tự nhiên.
- "tokens": mảng TỪNG CHỮ HÁN trong câu theo đúng thứ tự, BỎ dấu câu; mỗi phần tử là
  {"zh":"MỘT chữ Hán duy nhất","p":"pinyin có dấu của ĐÚNG chữ đó trong câu này"}.
  Đọc đúng âm đa âm theo ngữ cảnh (行, 长, 得, 了…). Số phần tử = số chữ Hán trong "zh".
- "vocab": các từ chính trong câu, mỗi từ {"w":"chữ Hán","p":"pinyin có dấu","vi":"nghĩa tiếng Việt"}.
- "grammar": giải thích ngữ pháp câu bằng tiếng Việt (2-4 câu ngắn).
Trả về DUY NHẤT JSON hợp lệ dạng:
{"sentences":[{"zh":"...","pinyin":"...","vi":"...","tokens":[{"zh":"我","p":"wǒ"}],
  "vocab":[{"w":"...","p":"...","vi":"..."}],"grammar":"..."}]}
Không thêm chữ nào ngoài JSON.`;

/* ---------- task: radical (giải thích bộ thủ của 1 chữ Hán) ----------
 * Cho 1 chữ Hán (kèm ngữ cảnh là từ chứa nó) → phân tích bộ thủ/thành phần cấu tạo
 * + mẹo nhớ, để người học liên hệ hình chữ với nghĩa. Bấm mới gọi (tiết kiệm API). */
const SYS_RADICAL = `Bạn là giáo viên tiếng Trung cho người Việt, giỏi chiết tự chữ Hán.
Cho MỘT chữ Hán giản thể (kèm ngữ cảnh là từ chứa nó), hãy phân tích để người học DỄ NHỚ:
- "components": các BỘ THỦ / thành phần cấu tạo nên chữ đó (theo tự dạng giản thể), THEO thứ tự,
  mỗi thành phần là {"part":"bộ/thành phần (chữ Hán)","name":"tên bộ thủ tiếng Việt (vd: bộ Thủy 氵, bộ Nhân 亻)","meaning":"nghĩa/biểu ý của thành phần đó"}.
  Nếu là thành phần biểu ÂM (gợi cách đọc) thì nói rõ trong "meaning".
- "mnemonic": 2-4 câu TIẾNG VIỆT liên kết các thành phần với NGHĨA của chữ và của từ chứa nó,
  tạo mẹo/câu chuyện dễ nhớ. Chính xác, KHÔNG bịa nghĩa sai; nếu chữ đơn giản/không chiết tự được thì nói thẳng.
Trả về DUY NHẤT JSON hợp lệ:
{"char":"chữ","components":[{"part":"...","name":"...","meaning":"..."}],"mnemonic":"..."}
Không thêm chữ nào ngoài JSON.`;

function promptRadical(b) {
  const c = String(b.char || "").trim();
  const ctx = b.word && b.word !== c
    ? ` (nằm trong từ 「${b.word}」${b.meaning ? " = " + b.meaning : ""})`
    : (b.meaning ? ` (nghĩa: ${b.meaning})` : "");
  return `Chữ Hán: ${c}${b.pinyin ? " đọc là " + b.pinyin : ""}${ctx}. Phân tích bộ thủ và tạo mẹo nhớ.`;
}

/* ---------- task: grammar (bài tập cho 1 điểm ngữ pháp) ---------- */
const SYS_GRAMMAR = `Bạn là giáo viên tiếng Trung cho người Việt học theo giáo trình HSK.
Cho MỘT điểm ngữ pháp, hãy soạn bài tập luyện ĐÚNG điểm ngữ pháp đó, dùng từ vựng và
câu ĐƠN GIẢN hợp trình độ HSK được cho. TRỘN 3 dạng bài sau (mỗi loại ít nhất 1 câu):

1) "mc" — Trắc nghiệm điền từ/chọn đáp án (4 phương án A,B,C,D):
   - "stem": câu tiếng Trung giản thể có chỗ trống ghi là ＿＿ (hoặc câu hỏi chọn cách dùng đúng).
   - "options": 4 phương án (chữ Hán ngắn); chỉ 1 đúng theo điểm ngữ pháp, 3 cái kia sai để gây nhiễu.
   - "correct": chỉ số 0-3 của đáp án đúng.
   - "pinyin": pinyin có dấu của câu đúng (đã điền); "vi": nghĩa tiếng Việt của câu đúng.
   - "explain": giải thích TIẾNG VIỆT vì sao đúng và vì sao mỗi phương án kia sai.

2) "order" — Sắp xếp câu:
   - "segments": mảng các CỤM TỪ chữ Hán theo ĐÚNG thứ tự tạo thành câu đúng (3-6 cụm; tách hợp lý,
     KHÔNG kèm dấu câu trong từng cụm).
   - "answer": câu hoàn chỉnh đúng (nối các segment, có thể thêm dấu câu cuối).
   - "pinyin": pinyin có dấu của câu; "vi": nghĩa tiếng Việt.
   - "explain": giải thích TIẾNG VIỆT trật tự từ theo điểm ngữ pháp.

3) "translate" — Dịch câu Việt → Trung:
   - "vi": câu tiếng Việt cần dịch (ngắn, đời thường, buộc dùng điểm ngữ pháp).
   - "answer": câu tiếng Trung giản thể đúng.
   - "pinyin": pinyin có dấu của câu đáp án.
   - "explain": giải thích TIẾNG VIỆT cách đặt câu theo điểm ngữ pháp.

Trả về DUY NHẤT JSON hợp lệ:
{"exercises":[
  {"type":"mc","stem":"...","options":["...","...","...","..."],"correct":0,"pinyin":"...","vi":"...","explain":"..."},
  {"type":"order","segments":["...","..."],"answer":"...","pinyin":"...","vi":"...","explain":"..."},
  {"type":"translate","vi":"...","answer":"...","pinyin":"...","explain":"..."}
]}
Không thêm chữ nào ngoài JSON.`;

function promptGrammar(b) {
  const n = Math.min(Math.max(parseInt(b.n, 10) || 5, 3), 8);
  const lv = String(b.level || "HSK1").trim() || "HSK1";
  const eg = (b.examples || []).map((e) => e && e.zh).filter(Boolean).slice(0, 2).join(" / ");
  return `Trình độ: ${lv}.
Điểm ngữ pháp: ${b.title || ""}.
Cấu trúc: ${b.formula || ""}.
Giải thích: ${b.explain || ""}.
${eg ? "Ví dụ mẫu: " + eg + "." : ""}
Soạn ĐÚNG ${n} câu bài tập luyện riêng điểm ngữ pháp này, trộn đủ 3 dạng mc/order/translate.`;
}

/* ---------- task: hskexam (tạo 1 đề thi HSK mô phỏng, nghe hoặc đọc) ----------
 * Sinh ~n câu trắc nghiệm CHẤM ĐƯỢC (correct = index), giữ NHẸ để tiết kiệm token:
 * chỉ ngữ liệu để LÀM đề. Pinyin/dịch/giải thích lấy sau bằng task "hskexplain". */
const SYS_HSKEXAM = `Bạn là chuyên gia soạn đề thi HSK (Hán ngữ Thủy bình Khảo thí) cho người Việt tự luyện.
Soạn MỘT đề mô phỏng theo đúng PHONG CÁCH đề thi HSK thật, dùng chữ Hán GIẢN THỂ, đúng phạm vi từ vựng/ngữ pháp của cấp được yêu cầu (không dùng từ vượt cấp).
Mọi câu là TRẮC NGHIỆM chấm tự động (có đáp án đúng). Câu hỏi và phương án viết bằng TIẾNG TRUNG (như đề thật).

- Nếu kỹ năng là "read" (đọc hiểu): mỗi câu có
  "passage": đoạn/câu tiếng Trung để đọc (ngắn gọn hợp cấp; có thể là 1-3 câu hoặc đoạn hội thoại),
  "q": câu hỏi tiếng Trung, "options": 3-4 phương án tiếng Trung, "correct": chỉ số 0-based của đáp án đúng.
- Nếu kỹ năng là "listen" (nghe hiểu): mỗi câu có
  "audio": lời cần ĐỌC TO cho thí sinh nghe — tiếng Trung tự nhiên (1 câu hoặc hội thoại ngắn 2 người), TỐI ĐA 180 ký tự,
  "q": câu hỏi tiếng Trung, "options": 3-4 phương án tiếng Trung, "correct": chỉ số 0-based.
  (KHÔNG lặp nguyên văn "audio" trong "q" — người nghe phải nghe rồi mới trả lời được.)

Ra đúng số câu được yêu cầu, độ khó tăng dần nhẹ. Phương án nhiễu phải hợp lý (cùng loại, dễ nhầm).
Trả về DUY NHẤT JSON hợp lệ:
{"title":"tên đề ngắn","questions":[{"passage":"...","q":"...","options":["...","...","..."],"correct":0}]}
(với "listen" thì thay "passage" bằng "audio"). Không thêm chữ nào ngoài JSON.`;

function promptHskExam(b) {
  const n = Math.min(Math.max(parseInt(b.n, 10) || 10, 4), 15);
  const lv = String(b.level || "HSK1").trim() || "HSK1";
  const skill = b.skill === "listen" ? "listen" : "read";
  return `Cấp: ${lv}. Kỹ năng: ${skill === "listen" ? "nghe hiểu (listen)" : "đọc hiểu (read)"}.
Soạn đề gồm ĐÚNG ${n} câu trắc nghiệm theo mô tả ở trên, đúng phạm vi ${lv}.`;
}

/* ---------- task: hskexplain (giải thích 1 câu trong đề — gọi khi bấm "Xem đáp án") ---------- */
const SYS_HSKEXPLAIN = `Bạn là giáo viên tiếng Trung cho người Việt, đang chữa MỘT câu trong đề thi HSK.
Cho ngữ liệu (đoạn đọc HOẶC lời nghe), câu hỏi, các phương án và chỉ số đáp án đúng, hãy trả về:
- "pinyin": pinyin CÓ DẤU của đoạn đọc/lời nghe (và câu hỏi nếu ngắn) — giúp người học đọc được.
- "vi": bản dịch TIẾNG VIỆT của ngữ liệu + câu hỏi + các phương án (ngắn gọn, rõ).
- "explain": giải thích TIẾNG VIỆT vì sao đáp án đúng là đúng, và vì sao từng phương án còn lại sai; nêu từ/mẫu câu đáng chú ý.
Chính xác, bám sát ngữ liệu, KHÔNG bịa. Trả về DUY NHẤT JSON hợp lệ:
{"pinyin":"...","vi":"...","explain":"..."}
Không thêm chữ nào ngoài JSON.`;

function promptHskExplain(b) {
  const it = b.item || {};
  const src = it.audio ? `Lời nghe: ${it.audio}` : `Đoạn đọc: ${it.passage || ""}`;
  const opts = Array.isArray(it.options)
    ? it.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("  ")
    : "";
  const lv = String(b.level || "HSK1").trim() || "HSK1";
  return `Cấp ${lv}, kỹ năng ${it.audio ? "nghe" : "đọc"}.
${src}
Câu hỏi: ${it.q || ""}
Phương án: ${opts}
Đáp án đúng: ${String.fromCharCode(65 + (parseInt(it.correct, 10) || 0))}.
Hãy chữa câu này.`;
}

async function callGemini(sys, prompt, maxTokens, apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("thiếu GEMINI_API_KEY");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens, responseMimeType: "application/json" },
      }),
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Gemini lỗi " + r.status);
  return j.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGroq(sys, prompt, maxTokens) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("thiếu GROQ_API_KEY");
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Groq lỗi " + r.status);
  return j.choices?.[0]?.message?.content || "";
}

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  throw new Error("không phân tích được JSON từ LLM");
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method không hỗ trợ" });

  try {
    const b = req.body || {};
    // "geminipro" = Gemini bản trả phí (GEMINI_PRO_API_KEY) — dùng khi nút "AI Pro".
    // Cùng model gemini-2.5-flash, chỉ khác API key (quota cao hơn). Thiếu key pro ⇒
    // rơi về GEMINI_API_KEY thường để không vỡ tính năng.
    const provider = b.provider === "groq" ? "groq"
      : b.provider === "geminipro" ? "geminipro" : "gemini";
    const proKey = process.env.GEMINI_PRO_API_KEY;
    const call = provider === "groq" ? callGroq
      : provider === "geminipro" ? (sys, prompt, mt) => callGemini(sys, prompt, mt, proKey)
      : callGemini;

    if (b.task === "quiz") {
      if (!Array.isArray(b.words) || b.words.length === 0)
        return res.status(400).json({ error: "thiếu words" });
      const raw = await call(SYS_QUIZ, promptQuiz(b), 3500);
      const out = parseJson(raw);
      const questions = (out.questions || []).filter(
        (q) => q && Array.isArray(q.options) && q.options.length === 4 &&
               Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3
      );
      return res.status(200).json({ questions });
    }

    if (b.task === "radical") {
      if (!b.char) return res.status(400).json({ error: "thiếu char" });
      const raw = await call(SYS_RADICAL, promptRadical(b), 2000);
      const out = parseJson(raw);
      const components = Array.isArray(out.components)
        ? out.components
            .filter((c) => c && (c.part || c.name))
            .map((c) => ({ part: String(c.part || ""), name: String(c.name || ""), meaning: String(c.meaning || "") }))
        : [];
      return res.status(200).json({
        char: String(out.char || b.char),
        components,
        mnemonic: String(out.mnemonic || ""),
      });
    }

    if (b.task === "grammar") {
      const raw = await call(SYS_GRAMMAR, promptGrammar(b), 3500);
      const out = parseJson(raw);
      const exercises = (out.exercises || [])
        .filter((e) => e && (e.type === "mc" || e.type === "order" || e.type === "translate"))
        .map((e) => {
          if (e.type === "mc") {
            return {
              type: "mc",
              stem: String(e.stem || ""),
              options: Array.isArray(e.options) ? e.options.slice(0, 4).map((o) => String(o)) : [],
              correct: Number.isInteger(e.correct) ? e.correct : 0,
              pinyin: String(e.pinyin || ""),
              vi: String(e.vi || ""),
              explain: String(e.explain || ""),
            };
          }
          if (e.type === "order") {
            return {
              type: "order",
              segments: Array.isArray(e.segments) ? e.segments.map((s) => String(s)).filter(Boolean) : [],
              answer: String(e.answer || ""),
              pinyin: String(e.pinyin || ""),
              vi: String(e.vi || ""),
              explain: String(e.explain || ""),
            };
          }
          return {
            type: "translate",
            vi: String(e.vi || ""),
            answer: String(e.answer || ""),
            pinyin: String(e.pinyin || ""),
            explain: String(e.explain || ""),
          };
        })
        .filter((e) =>
          e.type === "mc" ? e.options.length === 4 && e.correct >= 0 && e.correct <= 3 && e.stem
          : e.type === "order" ? e.segments.length >= 2 && e.answer
          : e.vi && e.answer
        );
      return res.status(200).json({ exercises });
    }

    if (b.task === "hskexam") {
      const raw = await call(SYS_HSKEXAM, promptHskExam(b), 4000);
      const out = parseJson(raw);
      const skill = b.skill === "listen" ? "listen" : "read";
      const questions = (out.questions || [])
        .map((q) => {
          const o = {
            q: String(q.q || ""),
            options: Array.isArray(q.options) ? q.options.slice(0, 4).map((x) => String(x)) : [],
            correct: Number.isInteger(q.correct) ? q.correct : parseInt(q.correct, 10) || 0,
          };
          if (skill === "listen") o.audio = String(q.audio || "").slice(0, 200);
          else o.passage = String(q.passage || "");
          return o;
        })
        .filter((q) => q.q && q.options.length >= 2 && q.options.length <= 4 &&
                       q.correct >= 0 && q.correct < q.options.length &&
                       (skill === "listen" ? q.audio : true));
      if (questions.length === 0) return res.status(502).json({ error: "AI không trả câu hỏi hợp lệ" });
      return res.status(200).json({ title: String(out.title || ""), skill, level: String(b.level || ""), questions });
    }

    if (b.task === "hskexplain") {
      const raw = await call(SYS_HSKEXPLAIN, promptHskExplain(b), 1500);
      const out = parseJson(raw);
      return res.status(200).json({
        pinyin: String(out.pinyin || ""),
        vi: String(out.vi || ""),
        explain: String(out.explain || ""),
      });
    }

    // "zh2vi" = 2 bài dịch (Trung→Việt / Việt→Trung); "listen" = nghe cả câu rồi gõ pinyin
    if (b.task === "sentences" || b.task === "zh2vi" || b.task === "listen") {
      const hear = b.task === "listen";
      const raw = await call(hear ? SYS_LISTEN : SYS_SENTENCES, promptSentences(b), hear ? 4000 : 3000);
      const out = parseJson(raw);
      const sentences = (out.sentences || [])
        .filter((s) => s && s.zh)
        .map((s) => {
          const o = {
            zh: String(s.zh),
            pinyin: String(s.pinyin || ""),
            vi: String(s.vi || ""),
            vocab: Array.isArray(s.vocab)
              ? s.vocab.filter((v) => v && v.w).map((v) => ({ w: String(v.w), p: String(v.p || ""), vi: String(v.vi || "") }))
              : [],
            grammar: String(s.grammar || ""),
          };
          if (hear) {
            const toks = Array.isArray(s.tokens)
              ? s.tokens.filter((t) => t && t.zh && t.p).map((t) => ({ zh: String(t.zh), p: String(t.p) }))
              : [];
            // chỉ giữ tokens khi khớp ĐÚNG các chữ Hán của câu (nếu lệch → frontend tự xoay xở)
            const hanOf = (x) => (String(x).match(/[㐀-鿿]/g) || []).join("");
            if (toks.length && hanOf(toks.map((t) => t.zh).join("")) === hanOf(o.zh)) o.tokens = toks;
          }
          return o;
        });
      return res.status(200).json({ sentences });
    }

    // mặc định: task example
    if (!b.word) return res.status(400).json({ error: "thiếu word" });
    const raw = await call(SYS_EXAMPLE, promptExample(b), 1200);
    const out = parseJson(raw);
    return res.status(200).json({ examples: out.examples || [] });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
