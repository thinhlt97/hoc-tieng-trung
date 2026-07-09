/* ============================================================================
 * data/grammar.js — Ngữ pháp HSK1 · HSK2 · HSK3 (offline, không cần API)
 * ----------------------------------------------------------------------------
 * Mỗi điểm ngữ pháp:
 *   { lv, id, title, formula, explain, examples:[{zh,p,vi}] }
 *     lv       : 1|2|3  (cấp HSK)
 *     id       : mã định danh (dùng cho key khi tạo bài tập)
 *     title    : tên điểm ngữ pháp (tiếng Việt + ký hiệu chữ Hán)
 *     formula  : công thức/cấu trúc ngắn gọn
 *     explain  : giải thích tiếng Việt
 *     examples : 2 câu ví dụ {zh: chữ Hán, p: pinyin có dấu, vi: nghĩa}
 *
 * Nút "Tạo bài tập" ở mỗi điểm sẽ gọi proxy AI (task:"grammar") sinh 5 câu
 * (trộn trắc nghiệm ABCD / sắp xếp câu / dịch câu). Danh sách này chỉ là phần
 * TIẾP XÚC + tra cứu, luôn xem được kể cả khi chưa bật AI.
 * ==========================================================================*/

const HSK_GRAMMAR = [
  /* ===================== HSK 1 ===================== */
  {
    lv: 1, id: "h1-shi", title: "是 — Khẳng định danh tính (A 是 B)",
    formula: "Chủ ngữ + 是 + Danh từ",
    explain: "「是」 nghĩa là “là”, dùng để nối hai danh từ/đại từ, khẳng định A chính là B. Phủ định dùng 「不是」. Lưu ý: KHÔNG dùng 是 trước tính từ (nói 我很高, không nói 我是高).",
    examples: [
      { zh: "我是学生。", p: "Wǒ shì xuéshēng.", vi: "Tôi là học sinh." },
      { zh: "他不是老师。", p: "Tā bú shì lǎoshī.", vi: "Anh ấy không phải giáo viên." },
    ],
  },
  {
    lv: 1, id: "h1-de", title: "的 — Sở hữu & định ngữ",
    formula: "A + 的 + B  ·  Tính từ/Cụm + 的 + Danh từ",
    explain: "「的」 nối định ngữ với danh từ đứng sau, thể hiện sở hữu (của) hoặc miêu tả. Với quan hệ thân thiết (gia đình, bạn bè) hoặc quốc gia thì thường lược bỏ 的: 我妈妈, 我们国家.",
    examples: [
      { zh: "这是我的书。", p: "Zhè shì wǒ de shū.", vi: "Đây là sách của tôi." },
      { zh: "他是一个好人。", p: "Tā shì yí ge hǎo rén.", vi: "Anh ấy là một người tốt." },
    ],
  },
  {
    lv: 1, id: "h1-bu", title: "不 — Phủ định (hiện tại/tương lai)",
    formula: "不 + Động từ/Tính từ",
    explain: "「不」 phủ định thói quen, ý muốn, trạng thái ở hiện tại/tương lai, đặt trước hầu hết động từ và tính từ. Riêng động từ 「有」 (có) phải phủ định bằng 「没」, không dùng 不有.",
    examples: [
      { zh: "我不喝咖啡。", p: "Wǒ bù hē kāfēi.", vi: "Tôi không uống cà phê." },
      { zh: "今天不冷。", p: "Jīntiān bù lěng.", vi: "Hôm nay không lạnh." },
    ],
  },
  {
    lv: 1, id: "h1-mei", title: "没(有) — Phủ định “có” và quá khứ",
    formula: "没(有) + Danh từ/Động từ",
    explain: "「没有」 phủ định sự sở hữu/tồn tại (không có) và phủ định hành động ĐÃ xảy ra (chưa/đã không làm). Khi dùng 没 thì bỏ 了: nói 我没吃, không nói 我没吃了.",
    examples: [
      { zh: "我没有钱。", p: "Wǒ méiyǒu qián.", vi: "Tôi không có tiền." },
      { zh: "他昨天没来。", p: "Tā zuótiān méi lái.", vi: "Hôm qua anh ấy không đến." },
    ],
  },
  {
    lv: 1, id: "h1-ma", title: "吗 — Câu hỏi có/không",
    formula: "Câu khẳng định + 吗？",
    explain: "Thêm 「吗」 vào cuối câu trần thuật để tạo câu hỏi trả lời “có/không” (đúng/sai), không cần đảo trật tự từ.",
    examples: [
      { zh: "你是中国人吗？", p: "Nǐ shì Zhōngguó rén ma?", vi: "Bạn là người Trung Quốc à?" },
      { zh: "你忙吗？", p: "Nǐ máng ma?", vi: "Bạn có bận không?" },
    ],
  },
  {
    lv: 1, id: "h1-ne", title: "呢 — Hỏi lại “… thì sao?”",
    formula: "Danh từ/Đại từ + 呢？",
    explain: "「呢」 đặt sau danh từ/đại từ để hỏi lại cùng nội dung vừa nói (“còn … thì sao?”), khỏi lặp lại cả câu.",
    examples: [
      { zh: "我很好，你呢？", p: "Wǒ hěn hǎo, nǐ ne?", vi: "Tôi khỏe, còn bạn?" },
      { zh: "我的书呢？", p: "Wǒ de shū ne?", vi: "Sách của tôi đâu rồi?" },
    ],
  },
  {
    lv: 1, id: "h1-qs", title: "Từ để hỏi 什么/谁/哪儿/几",
    formula: "Đặt từ hỏi ngay vị trí cần hỏi (không đảo câu)",
    explain: "Tiếng Trung không đảo trật tự khi hỏi: giữ nguyên cấu trúc, thay bộ phận cần hỏi bằng từ để hỏi — 什么 (gì), 谁 (ai), 哪儿 (đâu), 几 (mấy), 怎么 (thế nào).",
    examples: [
      { zh: "你叫什么名字？", p: "Nǐ jiào shénme míngzi?", vi: "Bạn tên là gì?" },
      { zh: "他在哪儿？", p: "Tā zài nǎr?", vi: "Anh ấy ở đâu?" },
    ],
  },
  {
    lv: 1, id: "h1-ji-duoshao", title: "几 / 多少 — Hỏi số lượng",
    formula: "几 + lượng từ + DT (nhỏ) · 多少 (+DT) (lớn)",
    explain: "「几」 hỏi số lượng nhỏ (thường dưới 10) và PHẢI đi kèm lượng từ. 「多少」 hỏi số lượng bất kỳ, có thể không cần lượng từ.",
    examples: [
      { zh: "你家有几口人？", p: "Nǐ jiā yǒu jǐ kǒu rén?", vi: "Nhà bạn có mấy người?" },
      { zh: "这个多少钱？", p: "Zhège duōshao qián?", vi: "Cái này bao nhiêu tiền?" },
    ],
  },
  {
    lv: 1, id: "h1-zai", title: "在 — Ở (địa điểm)",
    formula: "Chủ ngữ + 在 + Nơi chốn",
    explain: "「在」 làm động từ nghĩa “ở (tại)”, chỉ vị trí. Phủ định: 不在.",
    examples: [
      { zh: "我在家。", p: "Wǒ zài jiā.", vi: "Tôi ở nhà." },
      { zh: "老师不在学校。", p: "Lǎoshī bú zài xuéxiào.", vi: "Thầy không ở trường." },
    ],
  },
  {
    lv: 1, id: "h1-liangci", title: "个 và lượng từ",
    formula: "Số từ + Lượng từ + Danh từ",
    explain: "Giữa số từ và danh từ phải có lượng từ. 「个」 là lượng từ phổ biến nhất, dùng được cho nhiều danh từ; các danh từ khác có lượng từ riêng (本 sách, 杯 cốc, 口 người trong nhà…).",
    examples: [
      { zh: "我要三个苹果。", p: "Wǒ yào sān ge píngguǒ.", vi: "Tôi muốn ba quả táo." },
      { zh: "他有两本书。", p: "Tā yǒu liǎng běn shū.", vi: "Anh ấy có hai quyển sách." },
    ],
  },
  {
    lv: 1, id: "h1-xiang-yao", title: "想 / 要 — Muốn",
    formula: "想/要 + Động từ",
    explain: "「想」 = muốn/định (thiên về mong muốn, dự định), 「要」 = muốn/cần (ý chí mạnh hơn, sắp làm). Phủ định của cả hai thường dùng 「不想」.",
    examples: [
      { zh: "我想喝水。", p: "Wǒ xiǎng hē shuǐ.", vi: "Tôi muốn uống nước." },
      { zh: "我要买这个。", p: "Wǒ yào mǎi zhège.", vi: "Tôi muốn mua cái này." },
    ],
  },
  {
    lv: 1, id: "h1-le", title: "了 — Hoàn thành / thay đổi",
    formula: "Động từ + 了  ·  … 了 (cuối câu)",
    explain: "「了」 sau động từ chỉ hành động đã hoàn thành/xảy ra; 「了」 cuối câu chỉ sự thay đổi tình huống hoặc trạng thái mới. Phủ định dùng 没 và BỎ 了.",
    examples: [
      { zh: "我吃了饭。", p: "Wǒ chī le fàn.", vi: "Tôi đã ăn cơm rồi." },
      { zh: "天气冷了。", p: "Tiānqì lěng le.", vi: "Trời trở lạnh rồi." },
    ],
  },
  {
    lv: 1, id: "h1-tai", title: "太…了 — Quá, rất",
    formula: "太 + Tính từ + 了",
    explain: "Cấu trúc cảm thán chỉ mức độ cao “quá…”. 「太好了」 = “tuyệt quá”. Thường có 了 đi kèm.",
    examples: [
      { zh: "这个太贵了。", p: "Zhège tài guì le.", vi: "Cái này đắt quá." },
      { zh: "太好了！", p: "Tài hǎo le!", vi: "Tuyệt quá!" },
    ],
  },
  {
    lv: 1, id: "h1-he", title: "和 — Và (nối danh từ)",
    formula: "Danh từ + 和 + Danh từ",
    explain: "「和」 nối hai danh từ/đại từ ngang hàng (“và, với”). Lưu ý: 和 KHÔNG dùng để nối hai câu/hai động từ như “và” trong tiếng Việt.",
    examples: [
      { zh: "我和他是朋友。", p: "Wǒ hé tā shì péngyǒu.", vi: "Tôi và anh ấy là bạn." },
      { zh: "我喜欢苹果和香蕉。", p: "Wǒ xǐhuan píngguǒ hé xiāngjiāo.", vi: "Tôi thích táo và chuối." },
    ],
  },

  /* ===================== HSK 2 ===================== */
  {
    lv: 2, id: "h2-zhengzai", title: "正在…呢 — Đang (tiến hành)",
    formula: "(正)在 + Động từ (+ 呢)",
    explain: "Diễn tả hành động đang diễn ra. Có thể dùng 正在, 在, hoặc thêm 呢 cuối câu; phủ định: 没在 / 没(有).",
    examples: [
      { zh: "他正在打电话。", p: "Tā zhèngzài dǎ diànhuà.", vi: "Anh ấy đang gọi điện." },
      { zh: "我在看书呢。", p: "Wǒ zài kàn shū ne.", vi: "Tôi đang đọc sách." },
    ],
  },
  {
    lv: 2, id: "h2-guo", title: "过 — Đã từng (kinh nghiệm)",
    formula: "Động từ + 过",
    explain: "「过」 chỉ kinh nghiệm đã từng trải qua trong quá khứ. Phủ định: 没(有) + V + 过 (chưa từng).",
    examples: [
      { zh: "我去过北京。", p: "Wǒ qù guo Běijīng.", vi: "Tôi từng đến Bắc Kinh." },
      { zh: "他没吃过中国菜。", p: "Tā méi chī guo Zhōngguó cài.", vi: "Anh ấy chưa từng ăn món Trung Quốc." },
    ],
  },
  {
    lv: 2, id: "h2-yaole", title: "要…了 — Sắp",
    formula: "(快)要 + Động từ/Tính từ + 了",
    explain: "Diễn tả việc sắp xảy ra. Có thể dùng 要…了, 快要…了, 快…了.",
    examples: [
      { zh: "火车要开了。", p: "Huǒchē yào kāi le.", vi: "Tàu sắp chạy rồi." },
      { zh: "快要下雨了。", p: "Kuàiyào xià yǔ le.", vi: "Trời sắp mưa rồi." },
    ],
  },
  {
    lv: 2, id: "h2-bi", title: "比 — So sánh hơn",
    formula: "A + 比 + B + Tính từ (+ 一点儿/得多)",
    explain: "「比」 so sánh A hơn B. KHÔNG dùng 很/太 trước tính từ; muốn nhấn mức chênh lệch dùng 一点儿 (hơn chút), 得多/多了 (hơn nhiều). Phủ định thường dùng 没有: A 没有 B + adj.",
    examples: [
      { zh: "今天比昨天热。", p: "Jīntiān bǐ zuótiān rè.", vi: "Hôm nay nóng hơn hôm qua." },
      { zh: "他比我高一点儿。", p: "Tā bǐ wǒ gāo yìdiǎnr.", vi: "Anh ấy cao hơn tôi một chút." },
    ],
  },
  {
    lv: 2, id: "h2-youdian-yidian", title: "有点儿 / 一点儿 — phân biệt",
    formula: "有点儿 + Tính từ (than phiền) · Tính từ + 一点儿 (so sánh)",
    explain: "「有点儿」 đứng TRƯỚC tính từ, mang sắc thái không vừa ý (“hơi…”). 「一点儿」 đứng SAU tính từ, chỉ mức chênh lệch nhỏ (“…hơn một chút”).",
    examples: [
      { zh: "今天有点儿冷。", p: "Jīntiān yǒudiǎnr lěng.", vi: "Hôm nay hơi lạnh." },
      { zh: "便宜一点儿吧。", p: "Piányi yìdiǎnr ba.", vi: "Rẻ hơn một chút đi." },
    ],
  },
  {
    lv: 2, id: "h2-de-degree", title: "得 — Bổ ngữ trình độ",
    formula: "Động từ + 得 + Tính từ",
    explain: "「得」 nối động từ với bổ ngữ đánh giá mức độ/kết quả của hành động (chạy nhanh, nói giỏi…). Nếu động từ có tân ngữ phải lặp động từ: 他说汉语说得很好.",
    examples: [
      { zh: "他跑得很快。", p: "Tā pǎo de hěn kuài.", vi: "Anh ấy chạy rất nhanh." },
      { zh: "你说得对。", p: "Nǐ shuō de duì.", vi: "Bạn nói đúng." },
    ],
  },
  {
    lv: 2, id: "h2-yinwei", title: "因为…所以 — Vì… nên",
    formula: "因为 + Nguyên nhân，所以 + Kết quả",
    explain: "Cặp liên từ chỉ quan hệ nhân–quả. Có thể dùng cả cặp hoặc chỉ một vế.",
    examples: [
      { zh: "因为下雨，所以我没去。", p: "Yīnwèi xià yǔ, suǒyǐ wǒ méi qù.", vi: "Vì trời mưa nên tôi không đi." },
      { zh: "我喜欢他，因为他很好。", p: "Wǒ xǐhuan tā, yīnwèi tā hěn hǎo.", vi: "Tôi thích anh ấy vì anh ấy rất tốt." },
    ],
  },
  {
    lv: 2, id: "h2-suiran", title: "虽然…但是 — Tuy… nhưng",
    formula: "虽然 + A，但是/可是 + B",
    explain: "Cặp liên từ chỉ quan hệ nhượng bộ/tương phản. Vế sau dùng 但是 hoặc 可是.",
    examples: [
      { zh: "虽然很累，但是很开心。", p: "Suīrán hěn lèi, dànshì hěn kāixīn.", vi: "Tuy mệt nhưng rất vui." },
      { zh: "虽然贵，可是我很喜欢。", p: "Suīrán guì, kěshì wǒ hěn xǐhuan.", vi: "Tuy đắt nhưng tôi rất thích." },
    ],
  },
  {
    lv: 2, id: "h2-yibian", title: "一边…一边 — Vừa… vừa",
    formula: "一边 + V1，一边 + V2",
    explain: "Diễn tả hai hành động diễn ra đồng thời.",
    examples: [
      { zh: "他一边吃饭一边看电视。", p: "Tā yìbiān chī fàn yìbiān kàn diànshì.", vi: "Anh ấy vừa ăn cơm vừa xem tivi." },
      { zh: "我们一边走一边聊。", p: "Wǒmen yìbiān zǒu yìbiān liáo.", vi: "Chúng tôi vừa đi vừa trò chuyện." },
    ],
  },
  {
    lv: 2, id: "h2-cong-dao", title: "从…到 — Từ… đến",
    formula: "从 + A + 到 + B",
    explain: "Chỉ phạm vi thời gian hoặc không gian từ điểm A đến điểm B.",
    examples: [
      { zh: "我从八点到十点上课。", p: "Wǒ cóng bā diǎn dào shí diǎn shàngkè.", vi: "Tôi học từ 8 giờ đến 10 giờ." },
      { zh: "从家到公司很远。", p: "Cóng jiā dào gōngsī hěn yuǎn.", vi: "Từ nhà đến công ty rất xa." },
    ],
  },
  {
    lv: 2, id: "h2-li", title: "离 — Cách (khoảng cách)",
    formula: "A + 离 + B + 远/近",
    explain: "「离」 chỉ khoảng cách giữa hai điểm (nơi chốn hoặc thời gian) so với nhau.",
    examples: [
      { zh: "我家离学校很近。", p: "Wǒ jiā lí xuéxiào hěn jìn.", vi: "Nhà tôi gần trường." },
      { zh: "现在离上课还有十分钟。", p: "Xiànzài lí shàngkè hái yǒu shí fēnzhōng.", vi: "Còn mười phút nữa là vào học." },
    ],
  },
  {
    lv: 2, id: "h2-gei", title: "给 — Cho (giới từ)",
    formula: "给 + Người + Động từ",
    explain: "「给」 đứng trước tân ngữ chỉ đối tượng nhận hành động (“cho ai đó…”). Cũng là động từ “đưa/cho”.",
    examples: [
      { zh: "我给你打电话。", p: "Wǒ gěi nǐ dǎ diànhuà.", vi: "Tôi gọi điện cho bạn." },
      { zh: "请给我一杯水。", p: "Qǐng gěi wǒ yì bēi shuǐ.", vi: "Cho tôi một cốc nước." },
    ],
  },
  {
    lv: 2, id: "h2-rang", title: "让 — Bảo / khiến (câu sai khiến)",
    formula: "A + 让 + B + Động từ",
    explain: "「让」 nghĩa “bảo/để cho/khiến ai làm gì”. B vừa là tân ngữ của 让 vừa là chủ ngữ của động từ sau.",
    examples: [
      { zh: "妈妈让我早点儿睡。", p: "Māma ràng wǒ zǎo diǎnr shuì.", vi: "Mẹ bảo tôi ngủ sớm." },
      { zh: "老师让我们读课文。", p: "Lǎoshī ràng wǒmen dú kèwén.", vi: "Thầy bảo chúng tôi đọc bài." },
    ],
  },
  {
    lv: 2, id: "h2-bie", title: "别 — Đừng (cấm đoán)",
    formula: "别 + Động từ (+ 了)",
    explain: "「别」 dùng để khuyên ngăn/cấm “đừng làm gì”. Thêm 了 mang nghĩa “đừng làm nữa”.",
    examples: [
      { zh: "别说话！", p: "Bié shuōhuà!", vi: "Đừng nói chuyện!" },
      { zh: "别担心了。", p: "Bié dānxīn le.", vi: "Đừng lo nữa." },
    ],
  },
  {
    lv: 2, id: "h2-jiu-cai", title: "就 / 才 — Sớm/nhanh vs muộn/chậm",
    formula: "…就… (sớm, nhanh) · …才… (muộn, mới)",
    explain: "「就」 hàm ý sớm/nhanh/thuận lợi hơn dự kiến; 「才」 hàm ý muộn/chậm/khó khăn hơn dự kiến.",
    examples: [
      { zh: "他六点就起床了。", p: "Tā liù diǎn jiù qǐchuáng le.", vi: "Sáu giờ anh ấy đã dậy (sớm)." },
      { zh: "他九点才来。", p: "Tā jiǔ diǎn cái lái.", vi: "Chín giờ anh ấy mới đến (muộn)." },
    ],
  },

  /* ===================== HSK 3 ===================== */
  {
    lv: 3, id: "h3-ba", title: "把 — Câu chữ 把",
    formula: "Chủ ngữ + 把 + Tân ngữ + Động từ + thành phần khác",
    explain: "Câu chữ 把 nhấn mạnh sự XỬ LÝ và KẾT QUẢ tác động lên tân ngữ (đã xác định). Sau động từ phải có thành phần khác (了, 补语, tân ngữ…), không đứng trơ một mình.",
    examples: [
      { zh: "我把作业写完了。", p: "Wǒ bǎ zuòyè xiě wán le.", vi: "Tôi làm xong bài tập rồi." },
      { zh: "请把门关上。", p: "Qǐng bǎ mén guān shàng.", vi: "Làm ơn đóng cửa lại." },
    ],
  },
  {
    lv: 3, id: "h3-bei", title: "被 — Câu bị động",
    formula: "Tân ngữ + 被 (+ Chủ thể) + Động từ + thành phần khác",
    explain: "「被」 tạo câu bị động (bị/được). Chủ thể gây ra hành động có thể lược bỏ. Sau động từ thường có kết quả (了, 补语).",
    examples: [
      { zh: "我的手机被他借走了。", p: "Wǒ de shǒujī bèi tā jiè zǒu le.", vi: "Điện thoại của tôi bị anh ấy mượn mất." },
      { zh: "蛋糕被吃完了。", p: "Dàngāo bèi chī wán le.", vi: "Bánh bị ăn hết rồi." },
    ],
  },
  {
    lv: 3, id: "h3-bijiao", title: "比 nâng cao — 更/还, 没有…那么",
    formula: "A 比 B 更/还 + adj · A 没有 B (那么) + adj",
    explain: "Thêm 更/还 để nhấn “càng hơn”. Phủ định so sánh: 「A 没有 B (那么/这么) + adj」 = A không bằng B.",
    examples: [
      { zh: "他比我还高。", p: "Tā bǐ wǒ hái gāo.", vi: "Anh ấy còn cao hơn cả tôi." },
      { zh: "今天没有昨天那么冷。", p: "Jīntiān méiyǒu zuótiān nàme lěng.", vi: "Hôm nay không lạnh bằng hôm qua." },
    ],
  },
  {
    lv: 3, id: "h3-yuelaiyue", title: "越来越 / 越…越 — Càng ngày càng",
    formula: "越来越 + adj · 越 A 越 B",
    explain: "「越来越」 = càng ngày càng. 「越 A 越 B」 = càng A thì càng B (hai vế biến đổi theo nhau).",
    examples: [
      { zh: "天气越来越热了。", p: "Tiānqì yuè lái yuè rè le.", vi: "Thời tiết ngày càng nóng." },
      { zh: "雨越下越大。", p: "Yǔ yuè xià yuè dà.", vi: "Mưa càng lúc càng to." },
    ],
  },
  {
    lv: 3, id: "h3-yijiu", title: "一…就 — Vừa… là (liền)",
    formula: "一 + V1，就 + V2",
    explain: "Diễn tả hành động thứ hai xảy ra ngay sau hành động thứ nhất (“hễ… là…”).",
    examples: [
      { zh: "我一到家就给你打电话。", p: "Wǒ yí dào jiā jiù gěi nǐ dǎ diànhuà.", vi: "Tôi về đến nhà là gọi điện cho bạn ngay." },
      { zh: "他一累就想睡觉。", p: "Tā yí lèi jiù xiǎng shuìjiào.", vi: "Cứ mệt là anh ấy muốn ngủ." },
    ],
  },
  {
    lv: 3, id: "h3-chule", title: "除了…以外 — Ngoài… ra",
    formula: "除了 A 以外，都/也/还 …",
    explain: "「除了…以外」 kết hợp 都 = loại trừ A (ngoài A ra đều…); kết hợp 也/还 = bao gồm cả A (ngoài A ra còn…).",
    examples: [
      { zh: "除了他以外，我们都去了。", p: "Chúle tā yǐwài, wǒmen dōu qù le.", vi: "Ngoài anh ấy ra, chúng tôi đều đi." },
      { zh: "除了汉语，他还会英语。", p: "Chúle Hànyǔ, tā hái huì Yīngyǔ.", vi: "Ngoài tiếng Trung, anh ấy còn biết tiếng Anh." },
    ],
  },
  {
    lv: 3, id: "h3-budan", title: "不但…而且 — Không những… mà còn",
    formula: "不但 A，而且 B",
    explain: "Quan hệ tăng tiến: vế sau nâng cao hơn vế trước. Nếu hai vế cùng chủ ngữ, 不但 đứng sau chủ ngữ.",
    examples: [
      { zh: "他不但会说汉语，而且说得很好。", p: "Tā búdàn huì shuō Hànyǔ, érqiě shuō de hěn hǎo.", vi: "Anh ấy không những biết nói tiếng Trung mà còn nói rất giỏi." },
      { zh: "这个菜不但好吃，而且便宜。", p: "Zhège cài búdàn hǎochī, érqiě piányi.", vi: "Món này không những ngon mà còn rẻ." },
    ],
  },
  {
    lv: 3, id: "h3-ruguo", title: "如果…就 — Nếu… thì",
    formula: "如果 + Điều kiện，就 + Kết quả",
    explain: "Câu điều kiện giả định. Có thể thay 如果 bằng 要是; vế sau thường có 就.",
    examples: [
      { zh: "如果明天下雨，我就不去了。", p: "Rúguǒ míngtiān xià yǔ, wǒ jiù bú qù le.", vi: "Nếu mai trời mưa thì tôi không đi nữa." },
      { zh: "要是有时间，我就来看你。", p: "Yàoshi yǒu shíjiān, wǒ jiù lái kàn nǐ.", vi: "Nếu có thời gian, tôi sẽ đến thăm bạn." },
    ],
  },
  {
    lv: 3, id: "h3-zhiyao", title: "只要…就 / 只有…才",
    formula: "只要 A，就 B · 只有 A，才 B",
    explain: "「只要…就」 = chỉ cần A là B (điều kiện đủ). 「只有…才」 = chỉ có A mới B (điều kiện cần, duy nhất).",
    examples: [
      { zh: "只要努力，就能成功。", p: "Zhǐyào nǔlì, jiù néng chénggōng.", vi: "Chỉ cần cố gắng là sẽ thành công." },
      { zh: "只有多练习，才能学好。", p: "Zhǐyǒu duō liànxí, cái néng xué hǎo.", vi: "Chỉ có luyện tập nhiều mới học giỏi được." },
    ],
  },
  {
    lv: 3, id: "h3-jieguo", title: "Bổ ngữ kết quả (V + 完/好/到/见)",
    formula: "Động từ + 完/好/到/见/懂…",
    explain: "Thành phần đứng sau động từ cho biết KẾT QUẢ của hành động: 完 (xong), 好 (tốt/xong xuôi), 到 (đạt tới), 见 (cảm nhận thấy), 懂 (hiểu). Phủ định dùng 没.",
    examples: [
      { zh: "我听懂了。", p: "Wǒ tīng dǒng le.", vi: "Tôi nghe hiểu rồi." },
      { zh: "作业还没做完。", p: "Zuòyè hái méi zuò wán.", vi: "Bài tập vẫn chưa làm xong." },
    ],
  },
  {
    lv: 3, id: "h3-quxiang", title: "Bổ ngữ xu hướng (来 / 去)",
    formula: "Động từ + 来/去 (+ 上/下/进/出…)",
    explain: "「来」 chỉ hướng về phía người nói, 「去」 chỉ hướng ra xa. Kết hợp 上/下/进/出/回… tạo bổ ngữ xu hướng kép (进来, 出去…).",
    examples: [
      { zh: "他走进来了。", p: "Tā zǒu jìn lái le.", vi: "Anh ấy đi vào rồi." },
      { zh: "请你上来。", p: "Qǐng nǐ shàng lái.", vi: "Mời bạn lên đây." },
    ],
  },
  {
    lv: 3, id: "h3-keneng", title: "Bổ ngữ khả năng (V 得/不 + bổ ngữ)",
    formula: "Động từ + 得/不 + kết quả/xu hướng",
    explain: "Chèn 得 (có thể) hoặc 不 (không thể) giữa động từ và bổ ngữ để chỉ khả năng thực hiện: 听得懂 (nghe hiểu được) / 听不懂 (nghe không hiểu).",
    examples: [
      { zh: "这本书我看得懂。", p: "Zhè běn shū wǒ kàn de dǒng.", vi: "Cuốn sách này tôi đọc hiểu được." },
      { zh: "太远了，我走不到。", p: "Tài yuǎn le, wǒ zǒu bú dào.", vi: "Xa quá, tôi đi bộ không tới." },
    ],
  },
  {
    lv: 3, id: "h3-shide", title: "是…的 — Nhấn mạnh (thời gian/nơi chốn/cách thức)",
    formula: "是 + (thời gian/nơi/cách thức) + Động từ + 的",
    explain: "Với việc đã xảy ra, cấu trúc 「是…的」 nhấn mạnh vào KHI NÀO, Ở ĐÂU, BẰNG CÁCH NÀO hành động diễn ra. 是 có thể lược, 的 thì không.",
    examples: [
      { zh: "我是昨天来的。", p: "Wǒ shì zuótiān lái de.", vi: "Tôi đến vào hôm qua (đấy)." },
      { zh: "他是坐飞机去的。", p: "Tā shì zuò fēijī qù de.", vi: "Anh ấy đi bằng máy bay." },
    ],
  },
  {
    lv: 3, id: "h3-zhe", title: "着 — Trạng thái tiếp diễn",
    formula: "Động từ + 着",
    explain: "「着」 chỉ trạng thái đang duy trì (khác 在 chỉ hành động đang diễn ra). Hay dùng để tả tư thế/cách thức đi kèm hành động khác: 站着/开着门.",
    examples: [
      { zh: "门开着。", p: "Mén kāi zhe.", vi: "Cửa đang mở." },
      { zh: "他笑着说。", p: "Tā xiào zhe shuō.", vi: "Anh ấy vừa cười vừa nói." },
    ],
  },
  {
    lv: 3, id: "h3-weile", title: "为了 — Để (mục đích)",
    formula: "为了 + Mục đích，Chủ ngữ + …",
    explain: "「为了」 nêu mục đích của hành động, thường đứng đầu câu.",
    examples: [
      { zh: "为了学好汉语，他每天都练习。", p: "Wèile xué hǎo Hànyǔ, tā měitiān dōu liànxí.", vi: "Để học giỏi tiếng Trung, ngày nào anh ấy cũng luyện tập." },
      { zh: "为了身体健康，我常常运动。", p: "Wèile shēntǐ jiànkāng, wǒ chángcháng yùndòng.", vi: "Vì sức khỏe, tôi thường xuyên vận động." },
    ],
  },
  {
    lv: 3, id: "h3-meidou", title: "每…都 — Mỗi… đều",
    formula: "每 + (lượng từ) + DT + 都 …",
    explain: "「每」 (mỗi) thường đi cùng 「都」 để nhấn “không trừ trường hợp nào”.",
    examples: [
      { zh: "我每天都学习汉语。", p: "Wǒ měitiān dōu xuéxí Hànyǔ.", vi: "Ngày nào tôi cũng học tiếng Trung." },
      { zh: "每个人都有名字。", p: "Měi ge rén dōu yǒu míngzi.", vi: "Mỗi người đều có tên." },
    ],
  },
];

// Cho phép dùng khi nạp bằng <script> (gán global).
if (typeof window !== "undefined") {
  window.HSK_GRAMMAR = HSK_GRAMMAR;
}
