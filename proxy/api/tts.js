/* ============================================================================
 * proxy/api/tts.js — Vercel Serverless Function (vùng iad1, Mỹ)
 * ----------------------------------------------------------------------------
 * Proxy giọng đọc tiếng Trung tự nhiên (Google Translate TTS) → trả về MP3.
 * Vì sao cần proxy: trình duyệt không gọi thẳng được endpoint này (CORS), và
 * Web Speech API trên một số máy (đặc biệt Linux) nghe rất máy móc.
 *
 * GET ?q=你好   →  audio/mpeg
 *
 * Không cần API key. Giới hạn ~200 ký tự / lần (đủ cho từ & câu ngắn).
 * ==========================================================================*/

const ALLOWED_ORIGINS = [
  "https://hoc-tieng-trung.pages.dev",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method không hỗ trợ" });

  const q = (req.query.q || "").toString().trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: "thiếu q" });

  const url =
    "https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=" +
    encodeURIComponent(q);

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://translate.google.com/",
      },
    });
    if (!r.ok) return res.status(502).json({ error: "TTS upstream " + r.status });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=604800, immutable"); // cache 1 tuần
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
