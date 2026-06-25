# CLAUDE.md — Học tiếng Trung mỗi ngày (web tích lũy từ vựng → HSK5)

> File này để Claude Code đọc và tiếp tục dự án. Viết bằng tiếng Việt;
> phần hợp đồng API và mã định danh giữ nguyên tiếng Anh.

## 1. Dự án làm gì

Web app cá nhân học tiếng Trung, mục tiêu **đạt HSK5 vào ~10/2027**. Người dùng đã
có nền N4 tiếng Nhật (lợi thế nhận mặt Hán tự) và từng tiếp xúc tiếng Trung.
Triết lý: **giai đoạn đầu chỉ tiếp xúc** (đọc/nghe từ + câu để làm quen, tích lũy
dần), sau đó học nghiêm túc. Luồng dùng:

1. **Hôm nay**: mỗi ngày hiện một ít từ mới (mặc định 10) để tiếp xúc + danh sách
   từ tới hạn ôn. Bấm “Đã xem” để đưa từ vào lịch ôn.
2. **Từ vựng**: tra cứu toàn bộ từ HSK (lọc theo cấp/chủ đề, tìm kiếm), nghe phát
   âm, thêm vào lịch học.
3. **Câu**: các câu giao tiếp cơ bản kèm pinyin + nghĩa + phát âm.
4. **Luyện tập**: 4 kiểu — Flashcard, Chữ Hán→nghĩa (ABCD), Nghĩa→chữ Hán (ABCD),
   Nghe & chọn. Mọi kết quả tính vào **SRS (spaced repetition)**.
5. **Tiến độ**: streak, số từ đã thuộc, % HSK1, và lộ trình ước tính tới HSK5.
6. **Cài đặt**: mã cá nhân (đồng bộ), số từ mới/ngày, nhà cung cấp AI, xuất/nhập JSON.

Giao diện tiếng Việt, phong cách “báo chữ Hán” (font **Noto Serif SC** cho chữ Hán +
**Be Vietnam Pro** cho tiếng Việt; tông đỏ/vàng kim).

## 2. Kiến trúc tổng thể

Tham chiếu kiến trúc app tiếng Anh “The Touchline” (xem `/home/thinh/Downloads/CLAUDE.md`).

```
[Trình duyệt: index.html + data/hsk.js]
   │ (đồng bộ tiến độ theo mã)        │ (sinh câu ví dụ — tùy chọn)
   ▼                                   ▼
[vocab-worker: Cloudflare + KV]   [proxy: Vercel iad1 (Mỹ) /api/chinese]
                                        ├─ Gemini API
                                        └─ Groq API
```

3 thành phần:

### A. Frontend (thư mục gốc)
- `index.html` — 1 file HTML+CSS+JS, không framework. Toàn bộ logic SRS, UI, đồng bộ.
- `data/hsk.js` — dữ liệu từ vựng (`HSK_WORDS`) + câu (`HSK_SENTENCES`). **Offline**,
  không cần API. Thêm cấp HSK2/3… chỉ cần nối vào mảng `HSK_WORDS` (mỗi mục có `lv`).
- **Phát âm**: Web Speech API giọng `zh-CN` (không cần file âm thanh, không cần API).
- Hằng số cấu hình ở đầu thẻ `<script>`:
  - `VOCAB_URL` = URL vocab-worker (để trống ⇒ chỉ lưu localStorage trên máy này).
  - `PROXY_URL` = URL proxy Vercel `/api/chinese` (để trống ⇒ ẩn câu ví dụ AI).
  - `LS_KEY` = khóa localStorage.
- Hiện **tự chứa**: chạy được ngay không cần backend; backend chỉ để đồng bộ & ví dụ AI.

### B. vocab-worker — Cloudflare Worker + KV (`vocab-worker/`)
- `src/index.js`, `wrangler.toml` (bind KV namespace tên `VOCAB`).
- Lưu toàn bộ `state` (tiến độ SRS, stats, settings) theo **mã cá nhân**. Nhập cùng
  mã trên nhiều thiết bị ⇒ dùng chung. Key trong KV: `zh:<mã>`.

### C. proxy — Vercel (`proxy/`)
- `api/chinese.js` (Serverless Function), `vercel.json` ghim vùng `iad1` (Mỹ).
- **Vì sao Vercel:** Gemini chặn theo vị trí; Cloudflare Worker hay ở HK → 403.
  Vercel iad1 ở Mỹ nên không bị chặn. ĐỪNG chuyển phần gọi LLM về Cloudflare.
- Chỉ phục vụ **câu ví dụ** (từ vựng & đề trắc nghiệm tạo offline ở frontend → free).
- 2 nhà cung cấp: `gemini-2.5-flash`, `llama-3.3-70b-versatile`.

## 3. Hợp đồng API

**vocab-worker** (query `?code=MA`):
```
GET  ?code=MA              ← { "data": <state JSON> | null }
POST ?code=MA { "data":{} }← { "ok": true }
```

**proxy /api/chinese** (POST JSON):
```
→ { "task":"example", "word":"你好", "pinyin":"nǐ hǎo", "meaning":"xin chào",
    "provider":"gemini"|"groq" }
← { "examples":[ { "zh","pinyin","vi" } ] }
```
**Dịch câu** (kiểu luyện tập “📝 Dịch câu”):
```
→ { "task":"sentences", "level":"HSK1", "n":5, "provider":"gemini"|"groq" }
← { "sentences":[ { "zh","pinyin","vi","vocab":[{ "w","p","vi" }] } ] }
```
Lỗi luôn trả `{ "error":"..." }` kèm header CORS.

## 4. Mô hình dữ liệu (state lưu localStorage + KV)
```
{
  code, updatedAt,
  progress: { "<chữ Hán>": { ease, iv, due, reps, lapses, status, last } },
  stats: { streak, lastDay, reviewsToday, dayKey },
  settings: { dailyNew, provider }
}
```
- `status`: `new` → `learning` → `review` → `known` (iv ≥ 21 ngày).
- SRS kiểu SM-2 rút gọn (hàm `review(word, grade)`; grade 0=Quên,1=Khó,2=Nhớ/đúng).
- Đồng bộ **gộp theo từng từ** (`mergeStates`): giữ bản có `last` mới hơn → an toàn
  khi học trên 2 máy.

## 5. Biến môi trường (KHÔNG để khóa trong frontend)
- **proxy (Vercel):** `GEMINI_API_KEY`, `GROQ_API_KEY`. Đổi env xong phải **Redeploy**.
- **vocab-worker:** không cần khóa; cần bind KV `VOCAB`.
- **CORS:** cả hai có mảng `ALLOWED_ORIGINS` — phải chứa URL frontend (KHÔNG kèm `/` cuối).

## 6. Triển khai

**Chạy thử local:**
```
cd "/home/thinh/Downloads/Tieng Trung"
python3 -m http.server 8080      # rồi mở http://localhost:8080
```
(Phải chạy qua http server, không mở file:// — vì `data/hsk.js` nạp bằng <script src>.)

**vocab-worker (Cloudflare):**
```
cd vocab-worker
npx wrangler kv namespace create VOCAB   # dán id vào wrangler.toml
npx wrangler deploy                       # lấy URL → dán vào VOCAB_URL trong index.html
```

**proxy (Vercel):** import thư mục `proxy/` thành 1 project Vercel → set 2 env →
deploy → lấy URL `…/api/chinese` dán vào `PROXY_URL`. (Hoặc thêm `api/chinese.js`
vào project `x-translate-proxy` sẵn có để dùng chung.)

**Frontend:** host tĩnh bất kỳ (Cloudflare Pages / Workers). Nhớ thêm URL frontend
vào `ALLOWED_ORIGINS` của cả vocab-worker và proxy.

## 7. Gotcha (kế thừa từ app tiếng Anh)
- **Chặn vùng LLM:** phải gọi Gemini/Groq từ Vercel iad1 (Mỹ), KHÔNG từ Cloudflare.
- **Phát âm:** Web Speech `zh-CN` phụ thuộc giọng có sẵn của trình duyệt/OS. Chrome &
  điện thoại thường có; nếu máy không có giọng zh thì sẽ không phát ra tiếng.
- **Đồng bộ:** localStorage theo từng trình duyệt; muốn đa thiết bị phải nhập mã +
  có `VOCAB_URL`. App tự `syncPull()` khi mở nếu đã có mã.
- **Cache sau deploy:** Ctrl+Shift+R / ẩn danh.

## 8. Trạng thái hiện tại (đã DEPLOY)
- ✅ **Frontend:** https://hoc-tieng-trung.pages.dev (Cloudflare Pages, project `hoc-tieng-trung`).
  Deploy lại: copy `index.html` + `data/` + `manifest.webmanifest` + `sw.js` +
  `icons/` vào 1 thư mục sạch rồi
  `npx wrangler pages deploy <dir> --project-name hoc-tieng-trung --branch main`.
  ⚠ PWA cần đủ các file trên; thiếu `sw.js`/`manifest`/`icons` thì không cài app được.
  Sau khi đổi `sw.js` nhớ tăng `CACHE_VER` để ép client lấy bản mới.
- ✅ **vocab-worker (đồng bộ):** https://zh-vocab-worker.thinhlt1069-xnews.workers.dev
  · KV title `ZH_VOCAB` (id `b57e55d6d3a1461287254059f2178075`, binding `env.VOCAB`).
- ✅ **proxy (Vercel, scope `thinhlt1069s-projects`, project `proxy`):**
  https://proxy-one-olive-47.vercel.app · `/api/tts` (giọng Google) ✅ chạy,
  `/api/chinese` (ví dụ AI) ⏳ **còn thiếu env `GEMINI_API_KEY` / `GROQ_API_KEY`**.
  Deploy lại: `cd proxy && vercel deploy --prod --yes --scope thinhlt1069s-projects`.
- ✅ **1191 từ** (HSK1 151 + HSK2 147 + HSK3 295 + HSK4 598) + 33 câu;
  **8 kiểu luyện tập** + SRS. HSK3/HSK4 dịch từ danh sách chuẩn HSK 2012
  (nguồn `glxxyz/hskhsk.com`), pinyin lấy gốc, nghĩa Việt + pos + cat do bổ sung.
  pos thêm: `liên` (liên từ). cat thêm: `học tập`, `trang phục`, `thiên nhiên`.
- ✅ **Kiểu luyện tập** (8): Flashcard, Hán→nghĩa, Nghĩa→Hán, Nghe & chọn,
  **🎯 Trắc nghiệm 5 câu** (`makeExam`/`bindExamCard`/`examExplain`): mỗi phiên 5 câu
  ABCD, trộn ngẫu nhiên 4 dạng hỏi (Hán→nghĩa, nghĩa→Hán, pinyin→Hán, Hán→pinyin);
  chọn xong **hiện giải thích** (đúng: nghĩa+pinyin từ đúng; sai: nêu rõ từ bạn chọn
  thực ra nghĩa gì rồi mới chỉ đáp án đúng) + nút "Câu tiếp →". Chạy **offline** từ
  `HSK_WORDS`, tính vào SRS như các kiểu khác.
  **⌨ Nghe → gõ pinyin** (so khớp pinyin đã bỏ dấu, hàm `normPinyin`),
  **✍ Tập viết** (Hanzi Writer): mỗi chữ có 2 bước — ① xem mẫu thứ tự nét
  (animateCharacter **lặp liên tục** cho tới khi bấm "Tôi tự viết", tự cuộn ô vào
  giữa) → ② viết lại (quiz), hiện số nét, chấm theo số lần sai.
- ✅ **📝 Dịch câu** (kiểu luyện tập, `startTranslate`/`renderTranslate`/`transReveal`):
  AI tạo 5 câu tiếng Trung theo trình độ (lấy từ chip phạm vi qua `levelFromScope`,
  mặc định HSK1). Mỗi câu là 1 ô có nút "👁 Dịch nghĩa" — bấm để hiện/ẩn phiên âm +
  bản dịch + giải nghĩa từng từ vựng trong câu. Nút "↻ Tạo 5 câu khác". **Cần AI**
  (proxy `task:"sentences"` → `{sentences:[{zh,pinyin,vi,vocab:[{w,p,vi}]}]}`); KHÔNG
  tính vào SRS (câu tự do, không nằm trong `HSK_WORDS`). Nếu thiếu `PROXY_URL`/env thì
  báo cần bật AI.
- ✅ **Nút ✍ "xem cách viết" cạnh mỗi từ** ở tab Hôm nay & Từ vựng (`writeBtn` +
  `showStrokeGuide`): bấm để hiện/ẩn ô chạy thứ tự nét ngay tại chỗ (đa ký tự chạy
  lần lượt), có nút "▶ Xem lại". Dùng chung thư viện Hanzi Writer CDN.
- ✅ **Tiến độ**: thanh % cho **từng cấp** HSK1–4 (không còn hardcode HSK1) +
  **heatmap lịch sử ôn** 18 tuần (lưu ở `state.stats.history[ngày]`, gộp khi đồng bộ).
- ✅ **Phạm vi luyện tập**: chip HSK1/2/3/4 (scope `lv<N>` parse động trong `scopeWords`).
- ✅ **PWA**: `manifest.webmanifest` + `sw.js` + `icons/` (icon chữ 汉). Cài về điện
  thoại + chạy offline. SW: app shell network-first, font/CDN cache-first, API không
  cache. Đổi `CACHE_VER` trong `sw.js` khi muốn ép làm mới. Nút “⤓ Cài app” hiện ở
  header khi trình duyệt hỗ trợ `beforeinstallprompt`.
- ✅ **Luyện viết chữ Hán** (Hanzi Writer 3.7.1 qua CDN jsdelivr): kiểu luyện tập
  “✍ Tập viết” — viết từng nét, chấm theo số lần sai → tính vào SRS. Đa ký tự thì viết
  lần lượt từng chữ.
- ⏳ HSK5 sẽ bổ sung dần vào `data/hsk.js` (cùng cách: tải `…L5.txt` từ
  `glxxyz/hskhsk.com`, dịch nghĩa Việt). HSK5 ~1300 từ.

### Còn lại để bật câu ví dụ AI
Thêm 2 biến môi trường vào project Vercel `proxy` (lấy key từ project `x-translate-proxy`
sẵn có), rồi redeploy:
```
cd proxy
vercel env add GEMINI_API_KEY production --scope thinhlt1069s-projects
vercel env add GROQ_API_KEY  production --scope thinhlt1069s-projects
vercel deploy --prod --yes --scope thinhlt1069s-projects
```

## 9. Hướng phát triển tiếp (TODO)
- Bổ sung dữ liệu **HSK5** vào `data/hsk.js` (giữ đúng schema `{w,p,pos,vi,lv,cat}`).
- Soát lại nghĩa Việt HSK3/HSK4 (pinyin chuẩn theo nguồn, nghĩa do bổ sung).
- Đã làm: ✅ HSK3, ✅ HSK4, ✅ PWA, ✅ Tập viết (có mẫu thứ tự nét),
  ✅ Nghe → gõ pinyin, ✅ Heatmap lịch sử ôn, ✅ Tiến độ theo từng cấp.

## 10. Quy ước
- Giao diện & thông báo: tiếng Việt.
- Không framework ở frontend (thuần HTML/CSS/JS, dễ host tĩnh).
- Mọi khóa API ở server; frontend chỉ gọi proxy.
- Design tokens (màu/font) khai báo trong `:root` của `index.html`.
- Dữ liệu từ vựng tách riêng ở `data/hsk.js` để dễ mở rộng theo cấp.
