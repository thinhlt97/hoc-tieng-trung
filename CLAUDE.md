# CLAUDE.md — Học tiếng Trung mỗi ngày (web tích lũy từ vựng → HSK5)

> File này để Claude Code đọc và tiếp tục dự án. Viết bằng tiếng Việt;
> phần hợp đồng API và mã định danh giữ nguyên tiếng Anh.

## 1. Dự án làm gì

Web app cá nhân học tiếng Trung, mục tiêu **đạt HSK5 vào ~10/2027**. Người dùng đã
có nền N4 tiếng Nhật (lợi thế nhận mặt Hán tự) và từng tiếp xúc tiếng Trung.
Triết lý: **giai đoạn đầu chỉ tiếp xúc** (đọc/nghe từ + câu để làm quen, tích lũy
dần), sau đó học nghiêm túc. Luồng dùng:

1. **Hôm nay**: luôn hiển thị 15 từ mới (theo thứ tự HSK1→2→3→4, mặc định 15 —
   chỉnh ở Cài đặt) để tiếp xúc. Bấm **“Ôn tập”** đưa từ vào **Nhóm 1** (tab Từ đang
   ôn); từ đi rồi thì có từ kế tiếp thế chỗ (luôn giữ 15).
2. **Từ vựng**: tra cứu toàn bộ từ HSK (lọc theo cấp/chủ đề, tìm kiếm), nghe phát
   âm, nút “➕ Thêm vào lịch ôn” (đưa vào Nhóm 1); từ đã ôn hiện badge “Nhóm N”.
3. **Câu**: các câu giao tiếp cơ bản kèm pinyin + nghĩa + phát âm.
4. **Từ đang ôn** (`#view-review`): chia **3 nhóm** theo độ thành thạo.
   Nút chuyển THỦ CÔNG: Nhóm 1→2, 2→3, lùi lại, “✕ Bỏ ôn” (trả về là từ mới ở Hôm nay).
   Ngoài ra có **thăng nhóm TỰ ĐỘNG bằng điểm** (chỉ từ bài “Nghe → gõ pinyin”, xem §4).
   **Không có SRS lịch ôn tự động.**
5. **Luyện tập**: các kiểu bài (Flashcard, Hán→nghĩa, Nghĩa→Hán, Nghe & chọn,
   Nghe→gõ pinyin, Tập viết, Trắc nghiệm, Dịch câu). Mỗi phiên **15 câu**, bốc theo
   **tỉ lệ 70% Nhóm 1 · 20% Nhóm 2 · 10% Nhóm 3** (`buildPool(15)` → 11/3/1). Nhóm
   rỗng thì dồn quota sang nhóm còn từ (ưu tiên 1→2→3); nhóm ít từ thì cho lặp lại.
   Kết quả CHỈ tính vào streak/heatmap (`logReview`), KHÔNG tự đổi nhóm.
6. **Tiến độ**: streak, “từ đã nắm chắc” = Nhóm 3, % theo từng cấp, heatmap, lộ trình.
7. **Cài đặt**: mã cá nhân (đồng bộ), số từ hiển thị ở Hôm nay, nhà cung cấp AI,
   xuất/nhập JSON, **“Làm lại từ đầu”** (xóa tiến độ cả localStorage lẫn máy chủ,
   giữ nguyên danh sách từ vựng).

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
  Trường **`hv`** (tùy chọn) = **âm Hán Việt** (vd `学生` → `"HỌC SINH"`): hiện thành chip
  `漢 …` (`hvChip()`, CSS `.hv`) ở tab **Từ vựng** và **Từ đang ôn**, và tìm kiếm ở tab Từ
  vựng khớp được cả theo `hv`. Hiện MỚI CÓ cho **HSK1+HSK2** (285/298 từ); trợ từ (的, 了,
  吗, 呢, 吧, 着), chỉ định (这, 那, 哪, 些, 喂) và từ phiên âm (咖啡) **cố ý bỏ trống** vì âm
  Hán Việt không giúp nhớ nghĩa. Từ không có `hv` thì không hiện chip ⇒ thêm HSK3/4 sau này
  chỉ cần điền thêm `hv`, không phải sửa code.
- `data/grammar.js` — dữ liệu ngữ pháp (`HSK_GRAMMAR`) cho tab **Ngữ pháp**. **Offline**
  (tra cứu + tiếp xúc). Mỗi mục: `{lv, id, title, formula, explain, examples:[{zh,p,vi}]}`.
  Nút “🎯 Tạo bài tập” ở mỗi điểm mới cần AI (proxy `task:"grammar"`).
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
**Bài tập ngữ pháp** (nút “🎯 Tạo bài tập” ở tab Ngữ pháp — sinh 5 câu cho MỘT điểm):
```
→ { "task":"grammar", "title","formula","explain","examples":[{"zh"}],
    "level":"HSK2", "n":5, "provider":"gemini"|"groq" }
← { "exercises":[
    { "type":"mc",        "stem","options":[4],"correct":0..3,"pinyin","vi","explain" },
    { "type":"order",     "segments":[...],"answer","pinyin","vi","explain" },
    { "type":"translate", "vi","answer","pinyin","explain" } ] }
// Trộn 3 dạng: trắc nghiệm ABCD / sắp xếp cụm từ / dịch Việt→Trung. Chấm ngay ở client
// (order so khớp bỏ dấu câu; translate tự chấm bằng nút “Xem đáp án”). KHÔNG tính vào SRS.
```
Lỗi luôn trả `{ "error":"..." }` kèm header CORS.

## 4. Mô hình dữ liệu (state lưu localStorage + KV)
```
{
  code, updatedAt,
  progress: { "<chữ Hán>": { group:1|2|3, pts, addedAt, last, reps, correct } },
  stats: { streak, lastDay, reviewsToday, dayKey, history },
  settings: { dailyNew, provider, rate, voiceURI }
}
```
- **Mô hình 3 nhóm THỦ CÔNG** (thay cho SRS cũ). Có `progress[w]` ⇒ từ đang ôn;
  `group` = 1/2/3. Không có `group` ⇒ vẫn là "từ mới" ở tab Hôm nay.
- **Điểm & thăng nhóm tự động** (`pts`, chỉ tính ở kiểu luyện tập **“⌨ Nghe → gõ pinyin”**):
  gõ ĐÚNG ngay **lần bấm “Kiểm tra” đầu tiên** của câu ⇒ **+1**; sai ⇒ **−0,5**
  (ô “gõ lại cho đúng” sau khi sai KHÔNG tính điểm). Điểm **kẹp sàn 0** (không âm).
  Đủ **5 điểm ⇒ Nhóm 2**, đủ **10 điểm ⇒ Nhóm 3** (điểm cộng dồn, không reset khi lên nhóm).
  Chỉ **ĐẨY LÊN**: mất điểm KHÔNG hạ nhóm, và không kéo xuống nhóm người dùng đã tự tay chuyển
  (`target > group` mới đổi). Hàm: `scorePinyin(w, ok)` → `{pts, delta, promoted}`,
  `ptsOf/ptsGoal/fmtPts/ptsBadge`; hằng `PTS_G2=5`, `PTS_G3=10`. Gọi trong `bindTypeCard.check()`
  ngay sau `logReview`, bỏ qua khi `skipScore` (lúc khôi phục câu đã chấm ⇒ không cộng lại).
  UI: dòng “+1 điểm (tổng 4/5…)” trong ô kết quả, toast “🎉 lên Nhóm N”, badge `⌨ x/5 điểm`
  ở tab Từ đang ôn. Các kiểu luyện tập KHÁC không cộng/trừ điểm.
- Hàm chính (index.html):
  - `addToReview(w)` — đưa vào Nhóm 1; `moveGroup(w,g)` — chuyển nhóm (clamp 1..3);
    `removeFromReview(w)` — bỏ khỏi lịch ôn (mất luôn `pts`).
  - `reviewGroups()` → `{1:[],2:[],3:[]}` (giữ thứ tự HSK); `groupOf(w)`; `newCandidates()`.
  - `buildPool(total=15)` — bốc theo tỉ lệ 70/20/10, dồn quota nhóm rỗng + cho lặp.
  - `logReview(w,ok)` — ghi 1 lượt luyện tập (đếm + streak/heatmap), **KHÔNG đổi nhóm**.
- **Migration:** `migrateProgress(st)` — dữ liệu SRS cũ (không có `group`) ⇒ gán Nhóm 1
  (gọi trong `loadState`, sau `mergeStates` ở `syncPull`, và khi nhập JSON) để không
  bị "mất tích".
- **“Làm lại từ đầu”** (`resetBtn`): giữ `code`+`settings`, xóa progress/stats, rồi
  **POST ghi đè máy chủ** để dữ liệu cũ không bị kéo ngược về khi đồng bộ.
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
  `/api/chinese` ✅ chạy — `GEMINI_API_KEY` đã có (ví dụ AI, đề, bài tập ngữ pháp
  qua Gemini hoạt động thật; GROQ chưa xác nhận có key hay chưa).
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
- ✅ **Tab Ngữ pháp** (`#view-grammar`, `renderGrammar`): tổng hợp **45 điểm ngữ pháp**
  HSK1–3 offline (`data/grammar.js`), lọc theo cấp (chip HSK1/2/3), mỗi điểm có cấu trúc
  (`.gformula`) + giải thích + 2 ví dụ (có loa). Nút “🎯 Tạo bài tập” → `startGrammarEx(g)`
  gọi proxy `task:"grammar"` → `renderGrammarEx` hiện 5 câu trộn 3 dạng: trắc nghiệm ABCD
  (`grMcCard`), sắp xếp cụm từ (`grOrderCard`, bấm cụm để ghép/gỡ, `grNorm` so khớp bỏ dấu
  câu), dịch Việt→Trung (`grTransCard`, nút “👁 Xem đáp án”). KHÔNG tính vào SRS. Đã DEPLOY
  và chạy thật (Gemini trên proxy đã có key). Khi chưa bật AI thì báo cần AI.
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
