/* ============================================================================
 * vocab-worker — lưu tiến độ học tiếng Trung theo "mã cá nhân" (Cloudflare KV)
 * ----------------------------------------------------------------------------
 * GET  ?code=MA          → { data: <state JSON> }      (chưa có → { data:null })
 * POST ?code=MA { data } → { ok:true }                 (ghi đè state cho mã đó)
 * KV không bị giới hạn vùng nên đặt ở Cloudflare được (khác proxy LLM).
 * Bind KV namespace tên VOCAB trong wrangler.toml.
 * ==========================================================================*/

const ALLOWED_ORIGINS = [
  // KHÔNG kèm dấu "/" cuối. Thêm URL frontend sau khi deploy Cloudflare Pages/Workers.
  "https://hoc-tieng-trung.pages.dev",
  "https://tocfl-dai-loan.pages.dev",   // app tiếng Trung Đài Loan (SỬA thành tên project Pages thật của bạn)
  "http://localhost:8080",
  "http://localhost:8090",              // app Đài Loan chạy thử local
  "http://127.0.0.1:8080",
];

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(origin) });

    const url = new URL(request.url);
    const code = (url.searchParams.get("code") || "").trim();
    if (!code) return json({ error: "thiếu mã cá nhân (code)" }, 400, origin);
    const key = "zh:" + code;

    try {
      if (request.method === "GET") {
        const raw = await env.VOCAB.get(key);
        return json({ data: raw ? JSON.parse(raw) : null }, 200, origin);
      }
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (!body || typeof body.data !== "object")
          return json({ error: "body phải có trường data (object)" }, 400, origin);
        await env.VOCAB.put(key, JSON.stringify(body.data));
        return json({ ok: true }, 200, origin);
      }
      return json({ error: "method không hỗ trợ" }, 405, origin);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, origin);
    }
  },
};
