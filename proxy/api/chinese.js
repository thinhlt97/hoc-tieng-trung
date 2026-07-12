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
 * POST { task:"grammar", title, formula, explain, examples:[{zh}], level:"HSK2", n:5, provider }
 *  ←  { exercises:[
 *        { type:"mc",        stem, options:[4], correct:0..3, pinyin, vi, explain },
 *        { type:"order",     segments:[...], answer, pinyin, vi, explain },
 *        { type:"translate", vi, answer, pinyin, explain } ] }
 *
 * Env (Vercel → Settings → Environment Variables, đổi xong phải Redeploy):
 *   GEMINI_API_KEY, GROQ_API_KEY
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

async function callGemini(sys, prompt, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
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
    const provider = b.provider === "groq" ? "groq" : "gemini";
    const call = provider === "groq" ? callGroq : callGemini;

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

    // "zh2vi" = kiểu luyện tập "Dịch Trung → Việt" (cùng dạng dữ liệu, có thêm "grammar")
    if (b.task === "sentences" || b.task === "zh2vi") {
      const raw = await call(SYS_SENTENCES, promptSentences(b), 3000);
      const out = parseJson(raw);
      const sentences = (out.sentences || [])
        .filter((s) => s && s.zh)
        .map((s) => ({
          zh: String(s.zh),
          pinyin: String(s.pinyin || ""),
          vi: String(s.vi || ""),
          vocab: Array.isArray(s.vocab)
            ? s.vocab.filter((v) => v && v.w).map((v) => ({ w: String(v.w), p: String(v.p || ""), vi: String(v.vi || "") }))
            : [],
          grammar: String(s.grammar || ""),
        }));
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
