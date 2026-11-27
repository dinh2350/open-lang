# Brief tính năng gia sư open-lang (nghiên cứu ngày 2026-11-28)

Tài liệu này gom kết quả nghiên cứu 9 app học tiếng Anh và biến mỗi tính năng thành một brief để giao cho một session AI. Nó **không phải spec đã duyệt**. Mọi thứ ở đây là đề xuất; theo `CLAUDE.md`, mỗi brief vẫn phải đi qua `brainstorming` → spec được duyệt → `writing-plans` → TDD.

## Cách dùng (cho người giao việc)

Mỗi session làm một brief. Dán prompt mẫu này, thay `<Fn>`:

```text
Đọc docs/superpowers/research/2026-11-28-tutor-feature-briefs.md: phần "Bối cảnh chung" và brief <Fn>.
Dùng skill brainstorming để biến brief này thành spec; chưa viết code trước khi tôi duyệt spec.
Brief chỉ là đề xuất. Mục "Câu hỏi bạn quyết" phải hỏi tôi, đừng tự chọn.
Các "sự thật về code" trong brief có thể đã cũ (viết ngày 2026-11-28): kiểm lại bằng cách đọc file trước khi dựa vào.
```

## Cách đọc độ tin cậy

Mỗi dòng bằng chứng có nhãn:

- **[Chắc]**: trang gốc của hãng hoặc nghiên cứu, đã mở và đọc. Nó chỉ chứng minh app _nói là có_ tính năng, không chứng minh tính năng _có hiệu quả_.
- **[Vừa]**: hãng tự báo số liệu, bài phân tích của bên thứ ba, hoặc lời hãng trả lời trên Trustpilot.
- **[Yếu]**: mẫu rất nhỏ (ví dụ 22–23 đánh giá gần nhất) hoặc một nguồn duy nhất.
- **[Đề xuất của tôi]**: ý của người viết brief, không từ app nào.

Không có tính năng nào ở đây có bằng chứng độc lập rằng nó làm người học tiến bộ nhanh hơn. Các con số "tăng X%" đều do chính hãng tự báo.

## Bối cảnh chung (mọi brief đều dựa vào đây)

**Sản phẩm.** open-lang là gia sư tiếng Anh bằng giọng nói cho nhân viên văn phòng Việt Nam. Người học mở web, nói điều mình cần, gia sư giải thích bằng tiếng Việt, đọc mẫu tiếng Anh, sửa lỗi, và ghi chú bằng tool `saveNote`. Chiến lược: dùng cá nhân → bạn bè → thương mại. Giai đoạn 1 chưa cần thanh toán hay giới hạn miễn phí, nhưng dữ liệu của mỗi User phải tách biệt.

**Mục tiêu bao trùm của chủ dự án:** người học thấy học tiếng Anh _dễ dàng và nhẹ nhàng_, không phải bị nhồi kiến thức như các app truyền thống. Mọi tính năng phải được đánh giá theo mục tiêu này.

**Kiến trúc (pnpm monorepo):**

- `apps/agent`: LiveKit Agents (Node.js). Một `TutorAgent` duy nhất. Lời dẫn của gia sư ở `apps/agent/src/tutor-instructions.ts` (`tutorInstructions(order)`, `OPENING_LINE`).
- `apps/backend`: NestJS + Prisma + Postgres.
- `apps/frontend`: React, giao diện chỉ dùng Astryx. Chữ trên giao diện là tiếng Việt.
- `packages/shared`: hợp đồng zod dùng chung (`note.ts`, `conversation-report.ts`, `room-token.ts`).
- `e2e`: Playwright.

**Sự thật về code đã kiểm tra ngày 2026-11-28:**

- Agent **không biết gì về người học**. `apps/agent/src/conversation-agent.ts` bỏ qua metadata của job ("every Conversation is the same lesson"). `apps/backend/src/livekit/room-token.service.ts` điều agent vào phòng "with no metadata". Agent chỉ biết `roomName`. Danh tính participant của trình duyệt là `user.id`.
- Agent nói với backend qua `apps/agent/src/backend-client.ts`: `POST /api/agent/conversations/:roomName/{turns,notes,end}`, xác thực bằng `AGENT_API_KEY`, thử 3 lần, **không bao giờ reject** (backend chết chỉ làm mất ghi chú). Chưa có route nào để agent _đọc_ dữ liệu.
- Dữ liệu (`apps/backend/prisma/schema.prisma`): `User`, `Conversation` (`userId`, `roomName`, `endedAt`), `Turn`, `Note` (`kind`: phrase | word | correction | missed; `english`, `meaning`, `said`; duy nhất theo (conversation, kind, english); mỗi trường ≤ 120 ký tự; tối đa 50 ghi chú mỗi buổi), `Report` (`status`, `content` JSON). **Không có thực thể nào vượt qua ranh giới một buổi học.**
- Report (`apps/backend/src/reports/`): `assessment` (overview ≤ 160 ký tự, ≤ 2 điểm tốt, ≤ 3 điểm cần cải thiện) cộng chỉ số `fluency` tính từ transcript (`fluency.ts`: từ/phút, tỷ lệ nói, từ đệm ước lượng, lượt dài nhất). `REPORT_PROVIDER` mặc định `fake`; bộ chuyển đổi OpenAI/Google thật **chưa được kiểm chứng** (theo ghi chú dự án). Prompt hiện cấm khen suông và chấm điểm (`report-prompt.ts:13`).
- Frontend: `StartPanel` chỉ có một nút Bắt đầu. `ConversationSession` có Aura, ngăn bên (Cuộc nói, Ghi chú) và thanh điều khiển (mic, Kết thúc). `ReportPage` có hai tab (Đã học, Gia sư đánh giá). `HistoryPage` là bảng các buổi.
- Mô hình thật của chủ dự án là **Gemini Live** (`AGENT_MODE=realtime`, `REALTIME_PROVIDER=google`). Có các ràng buộc đã tốn công tìm ra, **đừng làm hỏng**: tool khai báo `NON_BLOCKING` (`config/session-options.ts`); gia sư gọi `saveNote` _trước khi nói_ trên Gemini Live (`noteOrderOf`); Gemini Live không có cài đặt tốc độ nói; `saveNote` bỏ `said` không thuộc `correction`. Phát hiện lượt nói do server của model (`turnDetection: 'realtime_llm'`). Không dùng LiveKit Inference (`test/no-livekit-inference.spec.ts` bắt buộc).
- Kiểm thử: unit của agent chạy qua `AgentSession` với provider giả (`apps/agent/test/`); check sống bằng provider thật ở `apps/agent/test/live/` (`pnpm test:live`); mô phỏng LiveKit ở `apps/agent/scenarios.yaml`; backend có test với DB; e2e Playwright ở `e2e/tests/`.

**Quy trình bắt buộc (`CLAUDE.md`):**

- Trước khi đổi hành vi: `brainstorming` → `writing-plans`; viết test trước (`test-driven-development`).
- Spec ở `docs/superpowers/specs/`, plan ở `docs/superpowers/plans/`, bằng chứng kiểm chứng ở `docs/superpowers/evidence/`.
- Xong việc khi `pnpm check` và `pnpm sonar` đều qua. Chạy thêm `pnpm test:e2e` khi động tới luồng Conversation, xác thực hoặc Agent.
- Không dùng `NOSONAR`, `@ts-ignore`, loại trừ ESLint/Sonar hay hạ ngưỡng khi chưa có người duyệt. Gặp Security Hotspot mới thì báo và dừng.

## Bản đồ phụ thuộc và thứ tự đề xuất (chưa được chủ dự án chốt)

```text
F0 Hồ sơ người học ──► F2 Bài vừa sức
        │            ├─► F3 Đề xuất bài hôm nay
        │            ├─► F6 Ôn lại
        │            ├─► F7 Tiến bộ ──► F13 Nhịp học
        │            ├─► F10 Nhớ người học
        │            └─► F16, F21 (tuỳ chọn lưu trong hồ sơ)
F9 Onboarding ──► ghi vào F0
F11 Sửa nhẹ, F19 Điều rút ra, F18, F20, N1–N4: làm được độc lập
F5 Chấm phát âm: chạy spike khả thi trước
```

**Dự án 1 (đề xuất):** F0 + F2 + F3 + F10 + F11 + F19. F11 là việc nhỏ (chỉ đổi hướng dẫn và test), nên làm trước hoặc song song. F5 tách thành một spike riêng.

---

## Nền móng

### F0. Hồ sơ người học (learner profile)

- **Giải quyết:** câu 1 (dẫn dắt), 2 (không dạy lại), 3.2 (lần sau). Không app nào quảng cáo nó, nhưng F2, F3, F6, F7, F10 đều cần nó.
- **Kết quả với người học:** gia sư biết mình đã học gì, thạo gì, đang cần gì, nên không hỏi lại từ đầu.
- **Các app làm thế nào:**
  - Duolingo theo dõi hai thứ: kiến thức của người học và độ khó của từng bài. Birdbrain "makes an educated guess about whether a learner will get a given exercise right". Một hệ riêng ước lượng "half-life" của từng từ trong trí nhớ ([Birdbrain 2020](https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain), [half-life 2016](https://blog.duolingo.com/how-we-learn-how-you-learn)). [Chắc; bài viết cũ, có thể không còn là hệ hiện tại]
  - Video Call của Duolingo: sau mỗi cuộc gọi, LLM đọc transcript và rút ra "a List of Facts", đưa vào hướng dẫn của cuộc gọi sau ([blog](https://blog.duolingo.com/ai-and-video-call)). [Chắc]
  - Praktika: "persistent memory layer that stores learner goals, preferences, and past mistakes"; truy xuất "immediately after the learner speaks"; tự báo Day-1 retention tăng 24% ([OpenAI](https://openai.com/index/praktika/)). [Vừa]
- **Open-lang hôm nay:** xem "Sự thật về code" ở trên. Ghi chú thuộc từng Conversation; cùng một câu ở hai buổi là hai `Note` khác nhau, không có liên kết. Danh sách buổi học ẩn các buổi không có lượt nói và không có ghi chú (`ConversationsService.list`).
- **Phạm vi v1 đề xuất:**
  - Thêm dữ liệu theo User: các mục đã gặp (nội dung tiếng Anh đã chuẩn hoá, loại, lần đầu gặp, lần gần nhất, số lần dạy, số lần người học tự nói đúng), cùng mục tiêu và trình độ (có thể trống).
  - Cập nhật **sau buổi học** ở backend, khi nhận end marker (giống cách Lily làm), từ transcript và ghi chú của buổi đó.
  - Cho agent đọc một "bản tóm tắt người học" ngắn, có giới hạn kích thước, khi bắt đầu buổi.
  - Không làm: lịch ôn (F6), giao diện (F7), thông báo.
- **Điểm chạm:** `apps/backend/prisma/schema.prisma` + migration; module backend mới cho hồ sơ; luồng end marker trong `conversations.service.ts` / `reports/`; hợp đồng mới trong `packages/shared`; `apps/agent/src/conversation-agent.ts`, `backend-client.ts` (đọc, có timeout), `tutor-instructions.ts` (đưa bản tóm tắt vào); `room-token.service.ts` nếu chọn đường metadata.
- **Kiểm chứng:**
  1. Buổi 1 dạy "I'd like to reschedule" và người học nói lại đúng. Buổi 2, bản tóm tắt liệt kê mục đó, và check sống (có judge) cho thấy gia sư không dạy lại từ đầu.
  2. Backend không trả lời được: buổi học vẫn bắt đầu bình thường (fail-open, giống `sendNote`).
  3. Hồ sơ của User A không bao giờ lọt sang User B (test tích hợp backend).
  4. Bản tóm tắt không vượt quá giới hạn kích thước đã chọn.
  5. Xoá User thì hồ sơ xoá theo (cascade).
- **Rủi ro:** dữ liệu cá nhân (transcript đã gửi cho nhà cung cấp model khi tạo Report); độ trễ lúc bắt đầu buổi; prompt phình ra trên Gemini Live; xếp nhầm "đã thạo" làm ẩn thứ người học còn cần.
- **Phụ thuộc:** không.
- **Câu hỏi bạn quyết:**
  1. "Đã thạo" nghĩa là gì? (ví dụ: tự nói đúng, không được nhắc, ở ≥ 2 buổi cách nhau ≥ N ngày; và có "quên dần" theo thời gian hay không.)
  2. Agent đọc hồ sơ bằng cách nào: backend nhét vào metadata khi điều agent (chỉ do server dựng, không lấy từ client), hay agent gọi một route mới `GET` bằng `AGENT_API_KEY`?
  3. Ai chuẩn hoá các mục (LLM sau buổi học hay luật đơn giản)?
  4. Dữ liệu giữ bao lâu, và người dùng có xem và xoá được không?

---

## Xếp hạng 1–9: phổ biến nhất ở các app đã đọc

### F1. Nói chuyện với AI, áp lực thấp, không phán xét (8/9 app)

- **Giải quyết:** câu 3.3 (dễ dàng, nhẹ nhàng).
- **Các app làm thế nào:**
  - Video Call của Duolingo "is all about practicing your speaking skills in a low-pressure setting" và "you won't be penalized for any mistakes!" ([blog](https://blog.duolingo.com/video-call)). [Chắc]
  - Praktika: "Making mistakes is part of learning — and Praktika is your safe space to practice." ([help](https://intercom.help/praktika-ai/en/articles/10707916-learning-process)). [Chắc]
  - YayTalk: luyện "without pressure or embarrassment" ([App Store VN](https://apps.apple.com/vn/app/id6743074605)). [Chắc]
  - Người dùng khen việc "nói được và tự tin": Praktika 5/23, TalkPal khoảng 7/22 đánh giá đọc được ([Trustpilot Praktika](https://www.trustpilot.com/review/praktika.ai), [TalkPal](https://www.trustpilot.com/review/talkpal.ai)). [Yếu]
  - Promova viết rằng bỏ dở là do _sợ_, không phải do khó dùng: "It is fear." Cách gỡ: câu mở đầu ít rủi ro, thử lại miễn phí và dễ thấy, nói rõ âm thanh được giữ riêng tư ([bài viết](https://dev.to/andrew-will/what-we-learned-designing-an-ai-tutor-for-language-learners-1124)). [Vừa; hãng tự kể]
  - Nghiên cứu: một meta-analysis 16 nghiên cứu cho hiệu ứng vừa (g = .61) của hệ thống hội thoại lên khả năng nói; phần giảm lo âu chỉ được nhắc trong phần giới thiệu, dẫn từ nghiên cứu khác ([Hou & Min 2025](https://www.cambridge.org/core/product/31847710516602398819C5E594038E7B)). [Chắc về nội dung bài; mẫu nghiên cứu nhỏ]
- **Open-lang hôm nay:** đã có nền: gia sư nói chuyện, giải thích bằng tiếng Việt, câu mở đầu "Chào bạn! Hôm nay bạn muốn học gì?" (`tutor-instructions.ts:2`). Chưa có hướng dẫn rõ về giọng điệu động viên.
- **Phạm vi v1 đề xuất:** thêm vào hướng dẫn của gia sư các quy tắc giọng điệu (ấm, không phán xét, lỗi là bình thường); viết check sống đánh giá giọng điệu. Câu "âm thanh của bạn riêng tư" chỉ được hiện **nếu đúng sự thật**: backend lưu _chữ_ của từng lượt nói (bảng `Turn`); chưa kiểm tra âm thanh có được lưu ở đâu không.
- **Kiểm chứng:** check sống với người học nói sai nhiều lần: gia sư không có câu kiểu "sai rồi", không chê; unit test `tutor-instructions.spec.ts` cho các quy tắc mới.
- **Câu hỏi bạn quyết:** giọng gia sư: ấm áp, hài hước hay nghiêm túc?
- **Gợi ý prompt:** nhấn mạnh "giọng điệu", không đổi cấu trúc dữ liệu.

### F2. Bài vừa trình độ (6/9 app)

- **Giải quyết:** câu 1, 2, 3.3. **Đây là phàn nàn số 1** ở mẫu Praktika: 4/23 đánh giá nói quá khó hoặc quá nhanh, ví dụ "is like B2 all of a sudden", "speaking much too fast for new learners" ([Trustpilot](https://www.trustpilot.com/review/praktika.ai)). [Yếu]
- **Các app làm thế nào:**
  - Birdbrain giữ bài ở mức vừa: "you're not reviewing material that you've already mastered or struggling with material that's too advanced"; "Birdbrain helps you automatically skip the topics you feel good about" ([blog](https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain)). [Chắc]
  - Lily nói đúng cấp CEFR; câu hỏi đầu tiên chọn đúng độ khó (ví dụ A2: "What kind of music do you like listening to?") ([blog](https://blog.duolingo.com/ai-and-video-call)). [Chắc]
  - Praktika: "Lessons are adaptive — the tutor adjusts content based on your level, pace, and types of mistakes." ([help](https://intercom.help/praktika-ai/en/articles/11684894-feedback-features)). [Chắc]
  - Loora: "Personalized conversations at your speaking level" ([App Store VN](https://apps.apple.com/vn/app/id1552708303)). YayTalk: lộ trình "adapts to your level, needs, and goals". [Chắc]
- **Open-lang hôm nay:** không có khái niệm trình độ. Hướng dẫn không nhắc trình độ; chỉ nói "Keep each turn short" và "Let the User choose what to learn" (`tutor-instructions.ts:28–31`). Với Gemini Live không chỉnh được tốc độ nói, chỉ qua lời dẫn.
- **Phạm vi v1 đề xuất:** ước lượng trình độ thô (ví dụ 3–4 mức, hoặc CEFR) từ lời người học sau buổi (qua F0), cho người học tự chọn lúc onboarding (F9); đưa "nói ở mức X: câu ngắn, từ đơn giản, chậm" vào lời dẫn; trong buổi, nếu người học khựng lại hoặc nói "không hiểu" thì tự hạ. Không làm: kiểm tra xếp lớp dài.
- **Kiểm chứng:** check sống với hai người học giả (A2 và B2) cho cùng yêu cầu: câu trả lời của gia sư khác nhau về độ phức tạp (judge); mô phỏng LiveKit tương ứng; kiểm tra `saveNote` vẫn hoạt động.
- **Rủi ro:** LLM ước lượng trình độ sai khi mẫu ít; người học muốn thử khó hơn; không chỉnh được tốc độ Gemini.
- **Phụ thuộc:** F0 (lưu trình độ), F9 (tự khai).
- **Câu hỏi bạn quyết:** CEFR hay 3 mức đơn giản? Tự khai hay suy ra, hay cả hai? Người học có đổi được bằng giọng nói ("khó quá", "cho mình bài khó hơn")?

### F3. Lộ trình: gia sư đề xuất bài hôm nay, vẫn cho nói tự do (6/9 app)

- **Giải quyết:** câu 1, 3.1.
- **Các app làm thế nào:**
  - Praktika: onboarding tạo "personalized study plan", người học sửa được qua biểu ngữ kế hoạch ([help](https://intercom.help/praktika-ai/en/articles/10707916-learning-process)); bài của OpenAI mô tả một "Learning Planning Agent ... to determine what to learn next, how to sequence skills" ([OpenAI](https://openai.com/index/praktika/)). [Chắc / Vừa]
  - YayTalk có "guided lesson path" **và** mục "Free Talks" ([ScreensDesign](https://screensdesign.com/showcase/yaytalk-learn-speak-english)). Đây đúng là mẫu "đề xuất + lối thoát". [Vừa; bên thứ ba]
  - Speak: "Our Speak Method is centered around three pillars: learn, practice, apply." ([blog](https://www.speak.com/blog/winter-2025)). Hala có "Structured Lessons". [Chắc]
  - Người dùng TalkPal khen "progression" 3/22; phàn nàn thiếu cấu trúc/ngữ pháp 2/22 ([Trustpilot](https://www.trustpilot.com/review/talkpal.ai)). [Yếu]
- **Open-lang hôm nay:** câu mở đầu cố định, bắt model đọc nguyên văn: `OPENING_LINE` ("Chào bạn! Hôm nay bạn muốn học gì?") và `OPENING_INSTRUCTIONS` (`tutor-instructions.ts`). Ba nơi phụ thuộc vào câu này: `apps/agent/test/greeting.spec.ts`, các check sống, và kịch bản đầu tiên trong `apps/agent/scenarios.yaml`.
- **Phạm vi v1 đề xuất:**
  - Với người đã có hồ sơ (F0): mở đầu bằng một đề xuất sinh từ hồ sơ, ví dụ "Hôm qua mình học _reschedule_. Ôn nhanh rồi học tiếp phần họp hành nhé? Hay bạn muốn nói điều khác?". Người học luôn đổi được.
  - Người mới (chưa có hồ sơ): giữ như hiện nay hoặc chạy F9.
  - Chủ đề công việc (họp, email, thuyết trình, phỏng vấn) làm _gợi ý chủ đề_ của gia sư, **không** làm tính năng luyện thi riêng.
  - Không làm: màn hình chọn bài, bảng lộ trình dài.
- **Điểm chạm:** `tutor-instructions.ts` (câu mở đầu thành lời chỉ dẫn thay vì câu cố định), test và kịch bản nói trên; cách agent nhận hồ sơ (xem F0).
- **Kiểm chứng:** (1) có hồ sơ → lời mở đầu nhắc đúng nội dung cũ và đề xuất bước tiếp, và hỏi lại người học; (2) người học trả lời "hôm nay mình muốn nói về chuyến công tác" → gia sư đi theo ngay; (3) người mới → vẫn hỏi muốn học gì; (4) cập nhật các check sống và kịch bản đang chờ câu mở đầu cũ.
- **Rủi ro:** quyết định 24/11 là "người học nói bất cứ điều gì mình cần"; đề xuất quá hăng sẽ trái với quyết định đó. Câu mở đầu hiện tất định, bản mới do model sinh nên khó kiểm hơn.
- **Phụ thuộc:** F0, F2; lợi hơn nếu có F10.
- **Câu hỏi bạn quyết:** (A) gia sư đề xuất, bạn đổi được, hay (B) giữ như cũ chỉ thêm nhớ? Gia sư đưa một đề xuất hay hai lựa chọn? Chủ đề công việc có danh sách cố định không?

### F4. Phản hồi sửa lỗi ngữ pháp và từ (6/9 app)

- **Giải quyết:** nền của câu 4 (ghi chú "Sửa lỗi") và điểm yếu ngữ pháp của bạn.
- **Các app làm thế nào:** Praktika ("helpful tips and subtle corrections"), Speak ("clear feedback"), Learna, Loora, Hala ("Real-Time Grammar Help"), YayTalk ("Instant Feedback & Corrections") đều có [Chắc]. Phàn nàn: 3/23 đánh giá Praktika nói AI nói sai (từ không tồn tại, phát âm sai, trộn ngôn ngữ) [Yếu]. Tôi không thấy nguồn nào mô tả cách các app kiểm tra độ đúng của chính lời sửa.
- **Open-lang hôm nay:** đã có: gia sư sửa bất cứ lúc nào (`tutor-instructions.ts:33`) và lưu `correction` với `said`, câu đúng và lý do tiếng Việt. Lời sửa nằm trong ghi chú mà **không có bước kiểm tra nào** ngoài chính model.
- **Phạm vi v1 đề xuất:** (a) chính sách _sửa lỗi nào_: ưu tiên lỗi ảnh hưởng nghĩa và lỗi lặp lại, bỏ lỗi vặt, tuỳ trình độ (xem F2); (b) tuỳ chọn: bước kiểm tra độ đúng của ghi chú `correction` trước khi lưu. F11 quyết định _khi nào_ nói ra; F4 quyết định _sửa gì_ và _đúng không_.
- **Kiểm chứng:** check sống: người học nói 3 lỗi trong một câu → chỉ sửa lỗi quan trọng nhất; ghi chú có `said` và câu đúng.
- **Rủi ro:** gia sư sửa sai làm người học học sai (người học thường không phát hiện được); chi phí và độ trễ của bước kiểm tra.
- **Câu hỏi bạn quyết:** có cần kiểm tra lời sửa bằng một lượt gọi model thứ hai không (tốn thêm tiền và độ trễ)?

### F5. Chấm phát âm (6/9 app)

- **Giải quyết:** điểm yếu phát âm của bạn (thứ ba trong danh sách tự đánh giá), không nằm trong 4 câu hỏi gốc.
- **Các app làm thế nào:**
  - Praktika: "an overall and per-word score considering your pronunciation, fluency, completeness and rhythm" ([help](https://intercom.help/praktika-ai/en/articles/10707916-learning-process)). [Chắc]
  - Learna, Loora, Hala (Premium), YayTalk ("Pronunciation Coach"): có theo mô tả cửa hàng. YayTalk chia điểm Fluency/Accuracy/Completeness theo [ScreensDesign](https://screensdesign.com/showcase/yaytalk-learn-speak-english). [Chắc / Vừa]
  - ELSA là app chuyên phát âm; ở Việt Nam có 285k đánh giá, 4,7 điểm, đứng #5 doanh thu iPhone; hãng tự nhận hơn 10 triệu lượt tải ở Việt Nam ([trang ELSA VN](https://vn.elsaspeak.com/homepage)). [Chắc về xếp hạng; số lượt tải do hãng tự báo]
  - Phàn nàn: nhận dạng giọng nói kém, 2/23 đánh giá Praktika, "The recognition is very poor." [Yếu]
- **Open-lang hôm nay:** không chấm phát âm. Chỉ số `fluency` tính từ _chữ_ (transcript), nên không đánh giá được phát âm. Model Gemini Live nhận âm thanh nên có thể nhận xét, nhưng hiện không có đầu ra có cấu trúc nào.
- **Phạm vi v1 đề xuất: chỉ là spike khả thi** (mã vứt đi, theo quy tắc spike). Câu hỏi cần trả lời: model hiện tại có phát hiện đáng tin những từ phát âm sai và nhất quán giữa các lần không? Đo bằng bộ câu có người nghe đối chiếu. Hướng 2, nếu hướng 1 không đạt, là một dịch vụ chấm phát âm riêng (chưa nghiên cứu).
- **Kiểm chứng:** kết quả spike ghi trong `docs/superpowers/evidence/`: tỷ lệ đồng ý với người nghe, số cảnh báo sai. Chưa viết spec cho đến khi có số này.
- **Rủi ro:** chấm sai làm nản; nếu muốn lưu thành loại ghi chú mới thì cần đổi `NoteKind` (migration + `packages/shared` + `note-groups.tsx`).
- **Câu hỏi bạn quyết:** mức ưu tiên so với ngữ pháp (thứ hai trong danh sách của bạn)?

### F6. Ôn lại đúng lúc, từ vựng tự lưu (6/9 app)

- **Giải quyết:** câu 2, 3.2.
- **Các app làm thế nào:**
  - Duolingo: mỗi lần nhớ đúng thì half-life tăng, sai thì giảm; "The best time to practice is when you are on the verge of forgetting"; tự báo +9.5% retention của các phiên luyện tập ([blog 2016](https://blog.duolingo.com/how-we-learn-how-you-learn)). [Vừa]
  - Speak có "Unit Refreshers ... pick up where you left off" ([blog](https://www.speak.com/blog/winter-2025)). Praktika cho học lại bài (khen: "easy to go back and retake lessons for a review", 1 đánh giá). Loora tự lưu từ người học vấp vào danh sách từ vựng ([ScreensDesign](https://screensdesign.com/showcase/speak-english-with-loora-ai)). Hala có thẻ từ vựng. [Chắc / Vừa]
- **Open-lang hôm nay:** ghi chú chỉ nằm trong từng buổi (tab Đã học); không ôn lại giữa các buổi.
- **Phạm vi v1 đề xuất:** "ôn nhanh bằng giọng nói" ngay đầu buổi: gia sư hỏi lại 2–3 mục đến hạn ("How would you say…?"), không đưa đáp án trước; lịch theo luật khoảng cách đơn giản, cập nhật theo việc người học nhớ đúng hay sai (cần F0). Không làm: giao diện thẻ ghi nhớ, thuật toán half-life đầy đủ.
- **Kiểm chứng:** unit test bộ lập lịch (hàm thuần): nhớ đúng → khoảng cách dài ra, sai → ngắn lại; check sống: gia sư hỏi mục đến hạn mà không nói đáp án trước; giới hạn tối đa 2–3 mục mỗi buổi; người học nói "bỏ qua" thì bỏ.
- **Rủi ro:** ôn lại thành cảm giác "nhồi nhét", ngược mục tiêu; vì thế phải ngắn và có thể bỏ qua.
- **Phụ thuộc:** F0 (bắt buộc); lợi hơn nếu có F3 (ôn nằm trong đề xuất bài hôm nay).
- **Câu hỏi bạn quyết:** chỉ ôn bằng giọng nói, hay thêm một màn hình ôn? Các khoảng cách (ngày)?

### F7. Theo dõi tiến bộ và đặt mục tiêu (5/9 app)

- **Giải quyết:** câu 3.2, 3.3, 4.
- **Các app làm thế nào:** Speak Level cho thấy "what you've mastered, what's next, and how your practice is paying off" ([blog](https://www.speak.com/blog/winter-2025)); Learna "Track your progress and set goals"; Loora có "daily English fluency score" và mốc mục tiêu trên dòng thời gian (ScreensDesign); YayTalk "Set learning goals, monitor your improvement"; Praktika: "you can see everything you've achieved — and feel proud of your progress!" [Chắc / Vừa]
- **Open-lang hôm nay:** `ReportPage` có dòng số liệu của _một buổi_ (từ/phút, tỷ lệ nói, từ đệm ước lượng, lượt dài nhất; `FluencyLine`); `HistoryPage` liệt kê buổi. Không có xu hướng, mục tiêu hay mức độ.
- **Phạm vi v1 đề xuất:** một màn hình đơn giản dựa trên F0: số mục đang học/đã thạo, số buổi trong 7 ngày, mục tiêu theo tuần (đặt ở F9). Tránh khung "mất chuỗi".
- **Rủi ro:** số từ/phút và "từ đệm" chỉ là ước lượng từ chữ; vẽ xu hướng của số ồn dễ gây hiểu sai.
- **Phụ thuộc:** F0, F9.
- **Câu hỏi bạn quyết:** hiện chỉ số nói hay chỉ hiện số mục đã học? Mục tiêu theo ngày hay theo tuần?

### F8. Nhập vai, tình huống (5/9 app)

- **Các app làm thế nào:** Speak: nhập vai là "genuine two-way conversation rather than following prewritten lines"; Praktika "interactive, goal-based lessons"; Hala "Interactive Roleplay (Premium)"; YayTalk "1000+ specific scenarios"; Loora có mô-đun phỏng vấn, họp, thuyết trình theo lời hãng. [Chắc / Vừa]
- **Open-lang hôm nay:** **đã bỏ có chủ ý ngày 2026-11-24**: gia sư không còn Scenario (migration `remove_scenario`). `scenarios.yaml` hiện chỉ là kịch bản kiểm thử gia sư.
- **Khuyến nghị:** không làm. Nếu muốn xem lại sau này, nên làm dưới dạng gia sư _tự đề nghị_ một tình huống nhỏ trong buổi học ("mình đóng sếp, bạn xin nghỉ nhé"), không thêm thực thể Scenario. Chỉ giữ brief này để ghi lại rằng hầu hết app đều có.
- **Câu hỏi bạn quyết:** có xem lại quyết định bỏ nhập vai không?

### F9. Onboarding: hỏi mục tiêu và trình độ (4/9 app)

- **Giải quyết:** câu 3.1 (lần đầu).
- **Các app làm thế nào:**
  - Duolingo (theo phân tích của [Appcues](https://goodux.appcues.com/blog/duolingo-user-onboarding), không phải Duolingo công bố): hỏi mục tiêu ("Why are you learning a language?"), rồi trình độ; người mới vào bài 101, người đã biết làm bài xếp lớp "starts off easy and gets harder"; vào bài học ngay; đăng ký là tuỳ chọn và để sau. [Vừa]
  - Praktika: onboarding tạo kế hoạch học, sửa được. [Chắc]
  - Loora 22 bước và YayTalk 48 bước (gồm bài kiểm tra từ vựng nhiều chặng, mục tiêu, thao tác nhấn giữ để cam kết), rồi mới tới paywall mềm ([ScreensDesign Loora](https://screensdesign.com/showcase/speak-english-with-loora-ai), [YayTalk](https://screensdesign.com/showcase/yaytalk-learn-speak-english)). [Vừa; bên thứ ba]
  - **Hai hướng trái nhau:** ngắn (Duolingo) và dài (Loora, YayTalk). Tôi không có số liệu chuyển đổi để chọn bên nào. Trang A/B về hoãn đăng ký của Duolingo (Taplytics) không mở được.
- **Open-lang hôm nay:** không có onboarding. `StartPanel` chỉ có một nút; người mới và người cũ vào cùng một buổi mở đầu. Các trang đăng nhập/đăng ký vẫn bằng tiếng Anh.
- **Phạm vi v1 đề xuất [Đề xuất của tôi]:** buổi đầu tiên là một cuộc "làm quen" 2–3 phút bằng giọng nói do chính gia sư hỏi (học để làm gì ở công việc, tự đánh giá trình độ, mục tiêu mỗi tuần, nghe thử vài câu để ước lượng), ghi vào F0. Có thể bỏ qua. Không làm bảng câu hỏi dài.
- **Kiểm chứng:** người mới (chưa có hồ sơ) được hỏi làm quen; người cũ thì không; bỏ qua vẫn vào học được; hồ sơ được lưu.
- **Phụ thuộc:** F0.
- **Câu hỏi bạn quyết:** hỏi bằng giọng nói hay một màn hình ngắn trước buổi đầu? Giai đoạn 1 (chỉ bạn dùng) có cần làm ngay hay để tới giai đoạn 2 (bạn bè)?

---

## Xếp hạng 10–23

### F10. Gia sư nhớ người học (3/9 app)

- **Giải quyết:** câu 1, 2, 3.2.
- **Các app làm thế nào:** Lily nhớ qua "List of Facts" (ví dụ hỏi lại "How are your dogs doing?") ([blog](https://blog.duolingo.com/ai-and-video-call)) [Chắc]; Praktika có lớp bộ nhớ ([OpenAI](https://openai.com/index/praktika/)) [Vừa]; Loora: hãng trả lời trên Trustpilot rằng "Loora gives me topics based on the conversation we have done before" ([Trustpilot](https://ca.trustpilot.com/review/loora.com)) [Vừa]. Trong các trang tôi đọc, chỉ ba app ghi rõ việc này.
- **Open-lang hôm nay:** không có.
- **Phạm vi v1 đề xuất:** ngoài các mục học (F0), rút ra **vài sự thật cá nhân** ngắn từ transcript (nghề, chủ đề hay nói, việc sắp tới) để gia sư nhắc tự nhiên ("Hôm qua bạn nói sắp họp với khách nước ngoài, hôm nay mình luyện nhé?"). Có một màn hình "Gia sư nhớ gì về bạn" cho xem và xoá [Đề xuất của tôi].
- **Rủi ro:** thông tin sai hoặc nhạy cảm bị lưu; cảm giác bị theo dõi, nên người học phải xem và xoá được.
- **Phụ thuộc:** F0.
- **Câu hỏi bạn quyết:** lưu những loại sự thật nào, và người học có tắt hẳn được không?

### F11. Sửa nhẹ, không ngắt lời (3/9 app)

- **Giải quyết:** câu 3.3.
- **Các app làm thế nào:**
  - Lily không sửa ngữ pháp giữa cuộc gọi: "one wrong word or mixed-up verb ending is completely fine as long as the other person understands you!" ([blog](https://blog.duolingo.com/video-call)). [Chắc]
  - Praktika: "subtle corrections that help you improve without interrupting the flow of the conversation" ([help](https://intercom.help/praktika-ai/en/articles/11684894-feedback-features)). [Chắc]
  - Promova: bản sửa mọi lỗi "unusable"; "Continuous correction turns a conversation into an exam, which is the exact stressor our users were already avoiding." ([bài viết](https://dev.to/andrew-will/what-we-learned-designing-an-ai-tutor-for-language-learners-1124)). [Vừa]
  - Loora: hãng nói phản hồi đến sau mỗi câu trả lời để không ngắt hội thoại; nhưng người dùng phàn nàn cả hai phía ("the corrections are only shown afterwards" và "it reacts too fast, before I complete my sentences") ([Trustpilot](https://ca.trustpilot.com/review/loora.com)). [Vừa / Yếu]
  - **Bằng chứng nghiên cứu yếu:** meta-analysis của Hou & Min không thấy việc có phản hồi sửa lỗi hay không làm kết quả khác đi đáng kể (mã hoá có/không). Tức là chưa có bằng chứng rằng sửa nhiều thì học tốt hơn.
- **Open-lang hôm nay:** `tutor-instructions.ts:33`: "You may correct the User's English at any time"; dòng 34: "say the better sentence in English, then explain the fix briefly in Vietnamese". Mỗi lần sửa còn gọi `saveNote` loại `correction`.
- **Phạm vi v1 đề xuất:** đổi chính sách trong lời dẫn: mặc định sửa kiểu "nói lại câu đúng một cách tự nhiên" như một phần câu trả lời, vẫn lưu ghi chú `correction` (giữ tab Sửa lỗi); chỉ giải thích khi người học hỏi, khi lỗi lặp lại hoặc làm khó hiểu; gom nhiều lỗi lại; cho người học chỉnh bằng giọng nói ("chỉ sửa khi mình hỏi", "sửa mình ngay"). Chỉ đổi lời dẫn và test.
- **Kiểm chứng (viết test trước):** check sống: người học nói ba lỗi trong một lượt → gia sư không liệt kê cả ba, vẫn trả lời tự nhiên và lưu 1–2 ghi chú đúng; "chỉ sửa khi mình hỏi" thì không tự sửa; `tutor-instructions.spec.ts` kiểm các câu mới; chạy `note-order.spec.ts` để chắc thứ tự `saveNote` trên Gemini Live không bị phá.
- **Rủi ro:** sửa quá nhẹ làm người học không thấy lỗi; phải giữ thứ tự gọi `saveNote` trước khi nói trên Gemini Live.
- **Phụ thuộc:** không.
- **Câu hỏi bạn quyết:** mặc định "sửa nhẹ" hay "sửa khi được hỏi"?

### F12. Phiên ngắn (2/9 app)

- **Giải quyết:** câu 3.3.
- **Các app làm thế nào:** Duolingo: bài học "a fast-paced 3-5 minutes" ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth), nguồn thứ cấp) [Vừa]; Video Call: người mới "last about a minute" ([blog](https://blog.duolingo.com/video-call)) và có lệnh "Psst! Say it's time to go." để cuộc gọi không kéo dài vô tận ([blog AI](https://blog.duolingo.com/ai-and-video-call)) [Chắc]; Praktika: khen "short lessons" (gộp với cấu trúc, 4/23) [Yếu]; Promova tự báo mỗi lần dùng khoảng 2,5 bài, khoảng 50–57% hoàn thành bài [Vừa; hãng tự báo, không có phương pháp].
- **Open-lang hôm nay:** không có độ dài buổi; gia sư không bao giờ kết thúc, người học bấm Kết thúc.
- **Phạm vi v1 đề xuất [Đề xuất của tôi]:** thêm lựa chọn "Bài nhanh 5 phút" bên cạnh học tự do: gia sư có điểm bắt đầu, điểm giữa, và kết thúc nhẹ ("Xong rồi! Hôm nay bạn học được 3 câu"), rồi hỏi có muốn học tiếp. Cần một đồng hồ phía agent.
- **Rủi ro:** người dùng (cũng là chủ dự án) từng học cả giờ; vì vậy phải là lựa chọn, không ép.
- **Câu hỏi bạn quyết:** thêm nút chọn kiểu buổi ở `StartPanel`, hay gia sư tự gợi ý ngắn hơn?

### F13. Nhịp học mềm (streak mềm, mừng thành tựu) (2/9 app)

- **Các app làm thế nào:** Speak thêm "streak freeze, streak repair, and milestone celebrations" ([blog](https://www.speak.com/blog/winter-2025)) [Chắc]. Các PM của Duolingo coi streak là đòn bẩy DAU quan trọng nhất (nguồn thứ cấp, [Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth)) [Vừa]. **Rủi ro có dẫn chứng:** theo [Decision Lab](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification), dẫn một nghiên cứu ở Journal of Consumer Research: người đứt streak dễ bỏ hẳn app, và khi sửa streak được thì động lực giữ streak giảm [Vừa]. Bài cũng nêu "streak creep" và viết "We optimize for the metric rather than the goal it was meant to represent".
- **Open-lang hôm nay:** không có; có thể suy ra từ `Conversation.createdAt`.
- **Phạm vi v1 đề xuất:** chỉ hiển thị nhịp theo **tuần** ("tuần này bạn học 3 ngày"), không có khung mất mát hay chuỗi bị đứt, không có bảng xếp hạng.
- **Phụ thuộc:** F7.
- **Câu hỏi bạn quyết:** có làm không? Trái ý "nhẹ nhàng" nếu làm kiểu Duolingo.

### F14. Xem lại buổi cũ, tải PDF (2/9 app)

- **Các app làm thế nào:** Praktika: "All your lessons are saved in the 'Completed lessons' section" và tải PDF ([help](https://intercom.help/praktika-ai/en/articles/10707916-learning-process)) [Chắc]; Loora: "you can always go back and review your past daily lessons anytime" (hãng, [Trustpilot](https://ca.trustpilot.com/review/loora.com)) [Vừa].
- **Open-lang hôm nay:** đã có "Lịch sử học" và `ReportPage` xem lại từng buổi. Chưa có xuất file hay "sổ tay" gộp nhiều buổi.
- **Phạm vi v1 đề xuất:** nút "Tải ghi chú" (Markdown hoặc PDF) trong `ReportPage`; sau này mới tới "Sổ tay" gộp các buổi (cần loại bỏ trùng, xem F0).
- **Kiểm chứng:** e2e tải file có đủ ghi chú của buổi.
- **Độ ưu tiên:** thấp.

### F15. Dịch hoặc giải thích bằng tiếng mẹ đẻ (2/9 app)

- **Các app làm thế nào:** YayTalk trả lời tiếng Anh kèm bản dịch sang tiếng mẹ đẻ, và có cửa sổ nhắc "chỉ học bằng tiếng Anh" (ScreensDesign) [Vừa]; Loora có "Real-time translation" ([App Store VN](https://apps.apple.com/vn/app/id1552708303)) [Chắc].
- **Open-lang hôm nay:** đã có theo thiết kế (gia sư giải thích bằng tiếng Việt, đọc mẫu bằng tiếng Anh).
- **Phạm vi v1 đề xuất:** tỷ lệ tiếng Việt theo trình độ (F2): người mới nhiều hơn, người khá ít hơn; công tắc bằng giọng nói "nói tiếng Anh nhiều hơn".
- **Phụ thuộc:** F2. **Độ ưu tiên:** thấp.

### F16. Chọn nhân vật, gia sư (2/9 app)

- **Các app làm thế nào:** YayTalk "Various AI Tutors That Meet Your Need" ([App Store VN](https://apps.apple.com/vn/app/id6743074605)); Praktika dùng avatar; Lily có tính cách cố định; một người dùng Loora phàn nàn "this app only provides female voice" ([Trustpilot](https://ca.trustpilot.com/review/loora.com)); Hala có nhiều giọng vùng (mô tả cửa hàng) [Chắc / Yếu].
- **Open-lang hôm nay:** một gia sư; giọng cấu hình qua biến môi trường của model realtime.
- **Phạm vi v1 đề xuất:** chọn giọng và phong cách (nhẹ nhàng, hài hước, nghiêm túc) lưu trong hồ sơ; mỗi phong cách là một biến thể lời dẫn.
- **Rủi ro:** mỗi biến thể nhân đôi bề mặt cần kiểm thử. **Độ ưu tiên:** thấp.

### F17. Luyện thi, tiếng Anh công việc (2/9 app)

- **Các app làm thế nào:** Hala: "IELTS Coach"; Loora: mô-đun phỏng vấn/họp/thuyết trình và TOEFL/IELTS theo trang chính thức ([loora.com](https://www.loora.com/)) [Chắc, lời hãng].
- **Khuyến nghị:** không làm riêng. Sản phẩm đã nhắm nhân viên văn phòng; chủ đề công việc nên là _gợi ý chủ đề_ trong F3. Luyện thi nằm ngoài phạm vi.

### F18. Cho thử lại, không phạt lỗi (2/9 app)

- **Các app làm thế nào:** Video Call: "you won't be penalized for any mistakes!" ([blog](https://blog.duolingo.com/video-call)); Praktika: "Try Again to have another go" ([help](https://intercom.help/praktika-ai/en/articles/10707916-learning-process)) [Chắc].
- **Open-lang hôm nay:** một phần: gia sư có thể nói lại chậm hơn và cho người học nói lại (`tutor-instructions.ts:35,38`); chưa có quy tắc giọng điệu "thử lại nhé" thay cho "sai rồi".
- **Khuyến nghị:** gộp vào F1 (giọng điệu) và F11 (cách sửa); không cần brief riêng.

### F19. Một điều rút ra cuối buổi (1/9 app)

- **Giải quyết:** câu 4 (ghi chú và đánh giá nhàm chán).
- **Các app làm thế nào:** hãng Loora trả lời trên Trustpilot: "After the conversation you get a review and one Key Takeaway: the most important mistake to work on next." ([Trustpilot](https://ca.trustpilot.com/review/loora.com)). [Vừa; lời hãng]. Hai nguồn mâu thuẫn: bài của ScreensDesign (bên thứ ba) gợi ý một bản tóm tắt gộp cuối buổi như một _cơ hội cải tiến_, nghĩa là có thể app chưa có (đây là suy luận của tác giả trang, không phải tài liệu của app). Trong các trang tôi đọc, phần tổng kết sau buổi học là nơi tôi thấy ít nguồn nhất.
- **Open-lang hôm nay:** `assessmentSchema` (`packages/shared/src/conversation-report.ts`): overview ≤ 160 ký tự, ≤ 2 điểm tốt, ≤ 3 điểm cần cải thiện. Prompt (`apps/backend/src/reports/report-prompt.ts:13`) cấm "praise filler" và điểm số. `ReportPage` hiện đánh giá thành đoạn văn cộng danh sách gạch đầu dòng, rồi một dòng số liệu nói. Chủ dự án thấy phần này **nhàm chán**.
- **Phạm vi v1 đề xuất [Đề xuất của tôi, không từ app nào]:** đổi bản đánh giá thành "Điều rút ra hôm nay":
  1. **Một điều cần nhớ**, kèm ví dụ lấy từ chính lời người học trong buổi.
  2. **Một điều bạn làm tốt**, trích đúng câu của họ.
  3. **Một bước tiếp theo** để buổi sau (nối với đề xuất ở F3).
     Số liệu nói đổi thành thống kê thân thiện ("Hôm nay bạn nói 4 phút, 12 câu") thay cho dòng từ/phút và từ đệm. Nếu có F0, thêm "trước và sau" (ví dụ tuần trước nói "I am agree", hôm nay "I agree").
- **Điểm chạm:** `assessmentSchema` + `conversationReportSchema` (shared), `report-prompt.ts`, `compose-report.ts`, `ReportPage` (`report-page.tsx`), test hợp đồng báo cáo, `e2e/tests/tutor-notes.spec.ts`. Việc đổi quy tắc "không khen suông" trong prompt là một quyết định cần người duyệt.
- **Kiểm chứng:** test hợp đồng với `fake` model; test frontend; e2e; **và chạy thử bộ chuyển đổi báo cáo thật (OpenAI/Google)**, vì hiện chưa được kiểm chứng.
- **Phụ thuộc:** không (v1 đứng một mình từ transcript); "trước và sau" cần F0.
- **Câu hỏi bạn quyết:** có bỏ chỉ số nói không? Có cho phép lời khen cụ thể (dẫn đúng câu họ nói)?

### F20. Gợi ý khi bí (1/9 app)

- **Các app làm thế nào:** YayTalk có mục "Don't Know What to Say? No Problem!" và nói "Never get stuck in silence" ([App Store VN](https://apps.apple.com/vn/app/id6743074605)) [Chắc]. Duolingo: người học có thể nói "What? I don't understand" hoặc nhờ Lily lặp lại ([blog](https://blog.duolingo.com/video-call)) [Chắc]. Promova: bắt đầu bằng "a concrete low-stakes prompt" [Vừa].
- **Open-lang hôm nay:** nếu người học im lặng, gia sư chờ. Chưa có xử lý "người học bí".
- **Phạm vi v1 đề xuất:** khi người học im lặng sau một câu hỏi, hoặc nói "mình không biết nói", gia sư đưa một câu mẫu tiếng Anh kèm gợi ý tiếng Việt để người học nói theo.
- **Việc cần kiểm tra:** agent có phát hiện được người học im lặng không? Xem tài liệu LiveKit (user state "away" hoặc tương đương) trong Node.js SDK và với Gemini Live (phát hiện lượt do server của model); dùng `livekit-docs` MCP. Chưa kiểm tra.
- **Rủi ro:** nhắc quá sớm cũng bị phàn nàn ("reacts too fast, before I complete my sentences" ở Loora); người học Việt thường dừng lâu để nghĩ.
- **Câu hỏi bạn quyết:** chờ bao lâu mới gợi ý? Chỉ khi người học xin gợi ý?

### F21. Chỉnh tốc độ nói (1/9 app)

- **Các app làm thế nào:** YayTalk đổi tốc độ nói trực tiếp trong khung chat (ScreensDesign) [Vừa].
- **Open-lang hôm nay:** một phần: OpenAI cố định tốc độ 1; Gemini không có cài đặt tốc độ; người học nhờ bằng giọng nói ("nói chậm hơn") và gia sư làm theo (`tutor-instructions.ts:35`). Nút "Chưa nghe kịp" đã được bỏ có chủ ý.
- **Phạm vi v1 đề xuất:** nhớ tốc độ ưa thích trong hồ sơ (F0) và mở đầu ở tốc độ đó. Không làm thanh trượt (không chỉnh được trên Gemini).
- **Phụ thuộc:** F0. **Độ ưu tiên:** thấp.

### F22. Nhắc học (1 đánh giá)

- **Bằng chứng:** một đánh giá Hala ở App Store Việt Nam khen việc app nhắc khi lâu không học ([Hala](https://apps.apple.com/vn/app/id6744363860)) [Yếu]. [Decision Lab](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification) gọi thông điệp tạo cảm giác tội lỗi của Duolingo ("You made Duo sad") là "an attempt to weaponize guilt".
- **Khuyến nghị:** hoãn tới giai đoạn 2 (bạn bè). Giai đoạn 1 chỉ có bạn dùng nên chưa cần. Nếu làm, dùng nhắc nhẹ, không gây tội lỗi.

### F23. Bảng xếp hạng, liên đoàn (1/9 app)

- **Bằng chứng:** Duolingo có bảng xếp hạng kết thúc hằng tuần vào giờ cố định, người dùng "rush in the last few hours" ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth)) [Vừa]. Decision Lab: "An excessive number of gamified experiences makes it hard to care about any individual streak."
- **Khuyến nghị:** **không làm.** Trái với mục tiêu "nhẹ nhàng". Giữ brief chỉ để ghi nhận.

---

## Điều kiện nền (không phải tính năng, nhưng người dùng phàn nàn nhiều)

Các việc này không cần F0 và có thể giao riêng.

### N1. Độ trễ và bị ngắt lời giữa câu

- **Bằng chứng:** Promova: "Several users described the tutor as 'judgmental' when the actual fault was a slow time-to-first-token"; "A fast, slightly-less-polished turn beat a slow, perfect one in every cohort we measured" ([bài viết](https://dev.to/andrew-will/what-we-learned-designing-an-ai-tutor-for-language-learners-1124)) [Vừa; hãng tự kể]. Một đánh giá Loora: "sometimes it reacts too fast, before I complete my sentences" ([Trustpilot](https://ca.trustpilot.com/review/loora.com)) [Yếu].
- **Open-lang hôm nay:** model realtime tự phát hiện lượt (`turnDetection: 'realtime_llm'`); chủ dự án từng gặp gia sư bị cắt ngang và im lặng sau `saveNote` (đã sửa, xem `docs/superpowers/evidence/2026-11-26-tool-silence/`). Người học Việt thường dừng lâu để nghĩ.
- **Việc cần làm:** (1) đo thời gian từ lúc người học ngừng nói đến âm thanh đầu tiên của gia sư (nhật ký hoặc chỉ số); (2) kiểm tra trong tài liệu LiveKit và Google xem có chỉnh được độ nhạy ngắt lời và thời gian chờ không. Chưa kiểm tra.

### N2. AI nói sai hoặc sửa sai

- **Bằng chứng:** 3/23 đánh giá Praktika (từ không tồn tại, phát âm sai, trộn ngôn ngữ) [Yếu].
- **Open-lang hôm nay:** ghi chú do chính model viết, không có bước kiểm tra. Xem F4.

### N3. Nhận dạng giọng nói sai

- **Bằng chứng:** 2/23 đánh giá Praktika [Yếu].
- **Open-lang hôm nay:** transcript lấy từ phiên âm đầu vào của model realtime; ghi chú `said` và Report dựa trên chữ có thể sai. Việc cần làm: lấy mẫu một số buổi và đối chiếu chữ với âm thanh.

### N4. Gia sư hỏi dồn, lặp câu hỏi

- **Bằng chứng:** Praktika 1/23 ("many questions are very repetitve"); một đánh giá Loora: "Only questions, then not improving english skills" [Yếu].
- **Open-lang hôm nay:** hướng dẫn có dòng "Ask one question at a time" (`tutor-instructions.ts:32`); cần xem nó có làm cuộc nói thành thẩm vấn không. Việc cần làm: đọc vài transcript thật để xem có hiện tượng này không.

### N5. Trừ tiền không báo trước

- **Bằng chứng:** 3/16 đánh giá App Store Việt Nam đọc được (Learna 2, YayTalk 1) nói bị trừ tiền không báo; thêm một đánh giá khoá thiết bị ở Learna; Trustpilot Loora và TalkPal mỗi nơi có một đánh giá tương tự [Yếu].
- **Ghi nhận cho giai đoạn 3:** thanh toán minh bạch, nhắc trước khi hết dùng thử.

---

## Phụ lục A. Quy mô các app (để biết mình đang so với ai)

Thị trường Việt Nam (App Store VN, mở ngày 2026-11-28) và bảng xếp hạng mục Giáo dục của Similarweb chụp ngày 2026-11-25. Xếp hạng doanh thu không phải lượt tải.

| App        | Điểm · số đánh giá (App Store VN) | Hạng miễn phí iPhone / Android                     | Hạng doanh thu iPhone / Android |
| ---------- | --------------------------------- | -------------------------------------------------- | ------------------------------- |
| Duolingo   | 4,7 · 790k                        | #4 / #1                                            | #1 / #1                         |
| ELSA Speak | 4,7 · 285k                        | #15 / ngoài top 51                                 | #5 / #35                        |
| Learna     | 4,7 · 82k                         | #3 / #10 (app cùng tên, có thể khác nhà phát hành) | #2 / #2                         |
| Speak      | 4,8 · 25k                         | ngoài top 51                                       | #13 / #8                        |
| Praktika   | 4,8 · 9,7k                        | ngoài top 51                                       | #40 / #5                        |
| TalkPal    | không lấy được                    | ngoài top 51                                       | #22 / #25                       |
| YayTalk    | 4,7 · 4,1k                        | chưa kiểm tra                                      | #3 iPhone / chưa kiểm tra       |
| Hala       | 4,8 · 4,5k                        | chưa kiểm tra                                      | #8 iPhone / chưa kiểm tra       |
| Loora      | 4,9 · 3,3k                        | chưa kiểm tra                                      | chưa kiểm tra / #4 Android      |

"Chưa kiểm tra" nghĩa là app không nằm trong top 15 của bảng tôi đọc và tôi không tra riêng hạng của nó. "Ngoài top 51" nghĩa là đã tìm trong cả 51 dòng của bảng và không thấy.

Lượt cài ước tính của bên thứ ba ([AppGoblin](https://appgoblin.info/apps/6478287397), crawl 2026-11-25/26): Learna ~46 triệu, Praktika ~21 triệu, Speak ~20 triệu, Loora ~9,6 triệu, YayTalk ~1,5 triệu, Hala ~0,18 triệu. Số lượt cài và đánh giá trên trang này không ghi nguồn; chỉ nên dùng làm thứ tự độ lớn. ELSA tự nhận hơn 40 triệu lượt tải toàn cầu và hơn 10 triệu ở Việt Nam, không ghi ngày.

## Phụ lục B. Chưa đọc, không đọc được, hoặc chưa kiểm chứng

- **App có trên bảng xếp hạng Việt Nam nhưng chưa đọc:** Babbel, Busuu, HelloTalk, Falou, 4You, Cake, Memrise.
- **Nhóm khác:** gia sư người thật (Cambly, Preply, italki), học thẳng với ChatGPT hay Gemini.
- **Nhóm tính năng gần như vắng mặt:** xã hội (bạn bè, trao đổi ngôn ngữ), học qua video, luyện nghe và shadowing (nghe là điểm yếu số 1 của chủ dự án), bài từ vựng sâu.
- **Không mở được:** trang onboarding của ELSA (404), Capterra Speak (403), MDPI (403), Google Play (trang chạy bằng JavaScript), hai PDF học thuật (bài bỏ học của Hwang và cs., nghiên cứu gia sư hội thoại arXiv 2508.05156), bài A/B của Taplytics.
- **Mỏng:** ELSA (chỉ trang chủ và trang cửa hàng); TalkPal (chỉ Trustpilot); Learna, Hala (chỉ trang cửa hàng và tracker). Chưa dùng thử app nào.
- **Bằng chứng về lý do người học bỏ app còn mỏng:** nguồn duy nhất đọc được là bài của italki, có lợi ích thương mại và chỉ là phỏng vấn định tính: năm điểm gãy là ngữ cảnh, phản hồi, kỷ luật, mức liên quan và độ sẵn có ([italki](https://www.italki.com/en/blog/when-do-language-learners-give-up-on-apps-and-turn-to-human-teachers)).
