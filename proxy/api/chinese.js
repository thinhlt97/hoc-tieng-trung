/* ============================================================================
 * proxy/api/chinese.js — Vercel Serverless Function (vùng iad1, Mỹ)
 * ----------------------------------------------------------------------------
 * Sinh CÂU VÍ DỤ cho một từ tiếng Trung. (Từ vựng/đề trắc nghiệm tạo offline ở
 * frontend nên không cần LLM — proxy này CHỈ phục vụ câu ví dụ.)
 *
 * Vì sao Vercel chứ không Cloudflare: Gemini chặn theo vị trí; Worker hay chạy
 * ở HK → 403. Vercel iad1 ở Mỹ nên không bị chặn. (Giống x-translate-proxy.)
 *
 * POST { task:"example", word, pinyin, meaning, provider:"gemini"|"groq" }
 *  ←  { examples:[ { zh, pinyin, vi } ] }
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

const SYS = `Bạn là giáo viên tiếng Trung cho người Việt mới học (trình độ HSK1-2).
Cho 1 từ tiếng Trung, hãy tạo 2 câu ví dụ NGẮN, ĐƠN GIẢN, dùng từ vựng cơ bản.
Trả về DUY NHẤT JSON hợp lệ dạng:
{"examples":[{"zh":"câu chữ Hán giản thể","pinyin":"pinyin có dấu thanh","vi":"dịch tiếng Việt tự nhiên"}]}
Không thêm chữ nào ngoài JSON.`;

function buildPrompt(b) {
  return `Từ: ${b.word} (${b.pinyin || ""}) nghĩa: ${b.meaning || ""}. Tạo 2 câu ví dụ.`;
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("thiếu GEMINI_API_KEY");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1200, responseMimeType: "application/json" },
      }),
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Gemini lỗi " + r.status);
  return j.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("thiếu GROQ_API_KEY");
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYS }, { role: "user", content: prompt }],
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
    if (!b.word) return res.status(400).json({ error: "thiếu word" });
    const provider = b.provider === "groq" ? "groq" : "gemini";
    const prompt = buildPrompt(b);
    const raw = provider === "groq" ? await callGroq(prompt) : await callGemini(prompt);
    const out = parseJson(raw);
    return res.status(200).json({ examples: out.examples || [] });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
