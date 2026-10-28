# Creative Hub

Ứng dụng web responsive giúp đội marketing tạo, quản lý và tải xuống hình ảnh
đúng nhận diện thương hiệu. Xem PRD đầy đủ tại
[`tasks/prd-creative-hub.md`](tasks/prd-creative-hub.md) và danh sách task tại
[`tasks/tasks-creative-hub.md`](tasks/tasks-creative-hub.md).

## Stack đã chọn (repo trống khi bắt đầu, xem PRD mục 17-18)

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Server Actions giữ secret phía server, không lộ ra browser |
| Database/Auth/Storage | Supabase (Postgres + Auth + Storage) | RLS ánh xạ tự nhiên vào mô hình workspace/brand/role; một hệ thống cho cả 3 nhu cầu |
| UI | Tailwind CSS v4 + shadcn/ui | Dựng nhanh, responsive, accessible sẵn |
| Icon | lucide-react | Đã có sẵn qua shadcn |
| Canvas editor (Task 4.0) | `react-konva` | Đủ cho layer ảnh/chữ/logo/hình khối ở mức MVP |
| Generation job (Task 3.0) | Bảng `generation_jobs` + poll từ client | Đơn giản, đủ cho khối lượng ban đầu, dễ nâng cấp lên hàng đợi thật sau |
| AI provider | Adapter interface riêng, có **Demo Provider** mặc định | Không tuyên bố sinh ảnh thật khi chưa cấu hình API key thật (PRD mục 15.10) |

Mọi quyết định đổi được — xem `src/lib/generation/providers/` khi Task 3.0 hoàn
thành để thay provider thật.

## Chạy local

```bash
npm install
cp .env.example .env.local   # điền giá trị Supabase project của bạn
npm run dev                  # http://localhost:3000
```

### Thiết lập Supabase

1. Tạo project Supabase (hoặc dùng project có sẵn).
2. Lấy `Project URL` và `anon public key` ở Project Settings → API, điền vào
   `.env.local`.
3. Chạy các file trong `supabase/migrations/` theo đúng thứ tự số, **thủ công**
   qua Supabase SQL Editor — không có gì tự động chạy migration, kể cả CLI
   chưa được link trong repo này. Hiện có:
   - `0001_init_workspaces_profiles.sql` — profiles, workspaces, memberships, RLS.
   - `0002_brands_guidelines.sql` — brands, brand_guideline_versions, bucket
     Storage `brand-assets` (private) + RLS/policy.
   - `0003_templates_presets.sql` — size_presets (workspace-scoped),
     templates (brand-scoped), RLS.
   - `0004_generation_jobs_assets.sql` — generation_jobs, **creative_assets**
     (chuyển sớm hơn kế hoạch gốc — xem ghi chú đầu file), bucket Storage
     `creative-assets` (private) + RLS/policy.
   - `0005_design_documents_exports.sql` — design_documents, exports,
     `creative_assets.current_design_document_id`.
4. (Tuỳ chọn, chưa bắt buộc ở Task 1.0-3.0) `SUPABASE_SERVICE_ROLE_KEY` chỉ
   cần khi có tính năng server-only dùng `src/lib/supabase/admin.ts`.

## Biến môi trường

Xem `.env.example` — danh sách đầy đủ và cập nhật sau mỗi lát cắt.

## Xác thực & Workspace (Task 1.0)

- Đăng nhập bằng email/mật khẩu (chọn phương thức này cho MVP — Google OAuth
  có thể thêm sau mà không đổi kiến trúc, chỉ cần bật provider trong Supabase
  Auth và thêm nút tương ứng).
- Khi đăng ký, một workspace mặc định được tạo tự động (trigger
  `handle_new_user` trong migration 0001) kèm membership `admin` cho chính
  người đó — người dùng mới có thể bắt đầu ngay, không cần bước onboarding
  riêng.
- 3 vai trò: `admin`, `creator`, `viewer` (RLS theo mục 4 PRD). Mọi kiểm tra
  quyền thực hiện phía server (RLS + `requireWorkspaceAdmin()`), không chỉ ẩn
  nút trên giao diện.
- **Giới hạn đã biết (Phase 1):** mời thành viên qua trang "Thành viên" chỉ
  hoạt động nếu người được mời đã có tài khoản Creative Hub từ trước (đăng ký
  ít nhất một lần). Luồng mời người hoàn toàn chưa có tài khoản (gửi email +
  token, họ bấm link rồi mới đăng ký) chưa được triển khai — đây là lựa chọn
  có chủ đích để giữ Phase 1 đơn giản (PRD mục 17: "chọn phương án đơn giản,
  an toàn, dễ thay thế"), không phải thiếu sót.

## Trang Cài đặt + ảnh đại diện người dùng

- Trang `/settings` được tổ chức lại thành 3 nhóm card (Tài khoản, Workspace,
  Thương hiệu & Thành viên — card cuối chỉ hiện với admin) thay vì 1 card đơn
  lẻ như trước — mỗi card dùng dữ liệu thật (đếm thương hiệu/thành viên thật
  qua `getBrands`/`getWorkspaceMembers`), không có mục nào chỉ có giao diện.
  Mục "Giao diện/Ngôn ngữ" KHÔNG được thêm: `layout.tsx` đang hardcode
  `defaultTheme="dark" enableSystem={false}` (không có cơ chế lưu preference
  nào) và app chưa có i18n — thêm mục đó sẽ là cài đặt giả.
- **Tên/email vẫn chỉ đọc** (không có cơ chế lưu nào trong repo cho
  `profiles.name`/`email` ngoài dữ liệu từ Supabase Auth) — chỉ **avatar** có
  thể chỉnh sửa thật, vì bucket Storage + action lưu đã được thêm riêng cho
  việc này (xem ngay dưới).
- **Ảnh đại diện — bucket Storage mới `avatars`** (migration
  `0007_avatars.sql`, **CẦN CHẠY THỦ CÔNG** trên dự án Supabase thật — môi
  trường này không có `SUPABASE_SERVICE_ROLE_KEY` hay Supabase CLI đã link
  nên không tự áp dụng được, giống mọi migration trước đó trong repo):
  - Private bucket, đường dẫn `<user_id>/<uuid>.<ext>`, giới hạn 5MB,
    `image/png|jpeg|webp`.
  - RLS SELECT **rộng hơn** `brand-assets` (không giới hạn theo workspace):
    bất kỳ user đã đăng nhập nào cũng xin được signed URL cho bất kỳ avatar
    nào — cần thiết vì avatar của một người hiện ra ở `members-table.tsx`
    của MỌI workspace họ tham gia, không chỉ một. INSERT/UPDATE/DELETE vẫn
    chỉ chủ sở hữu (`(storage.foldername(name))[1]::uuid = auth.uid()`).
  - `profiles.avatar_url` lưu **đường dẫn Storage**, không phải URL — cùng
    quy ước với `brands.avatar_url` — resolve thành signed URL (TTL 1 giờ)
    tại `getCurrentUser()`/`getWorkspaceMembers()`
    (`src/lib/workspace/queries.ts`) qua `resolveAvatarUrl()` mới
    (`src/lib/profile/storage.ts`).
  - `uploadAvatar()`/`removeAvatar()` (`src/lib/profile/actions.ts`): thứ tự
    ghi an toàn — upload file mới → cập nhật `profiles.avatar_url` → **sau
    đó mới** xoá file cũ (dọn dẹp best-effort, không chặn flow nếu lỗi) —
    không bao giờ để profile trỏ vào file đã bị xoá nếu một bước giữa chừng
    thất bại.
  - `revalidatePath("/", "layout")` sau khi lưu/xoá — đồng bộ avatar mới ở
    sidebar/header (`UserMenu`), trang Cài đặt và `/members` cùng lúc, không
    cần người dùng tải lại trang.
  - Preview khi chọn file: `URL.createObjectURL` hiển thị NGAY trong khung
    tròn (dùng chung `AvatarImage` với `object-cover` có sẵn — tự crop vuông
    giữa ảnh, không kéo méo), thay bằng URL thật từ server sau khi lưu thành
    công; nếu lưu lỗi thì quay lại ảnh cũ, không "giả" một lần lưu không xảy
    ra.
  - **Chưa thể xác minh**: migration chưa được áp dụng lên dự án Supabase
    thật trong phiên này (không có quyền) nên luồng upload/xoá thật
    chưa chạy thử — chỉ xác minh qua `tsc`/`eslint`/`npm run build` (đều
    sạch) và đọc logic.

## Thương hiệu & brand guideline (Task 2.0)

- Mỗi brand chỉnh sửa guideline lưu một **version mới** mỗi lần lưu (không
  sửa đè) — `brands.current_guideline_version_id` luôn trỏ tới version mới
  nhất. Cơ chế này chuẩn bị sẵn cho PRD §8.2: tài sản tạo ra sau này sẽ
  snapshot version đang hiện hành tại thời điểm tạo (nối vào Task 3.0+).
- Logo và avatar thương hiệu lưu trong bucket Storage **private**
  `brand-assets` (không public URL) — mọi hiển thị đi qua signed URL có hạn
  1 giờ, tự tạo lại mỗi lần tải trang, luôn tôn trọng RLS của người xem.
- **Giới hạn đã biết:** Font chọn từ danh sách cố định (`src/lib/brand/fonts.ts`,
  Aeonik Pro — font thương hiệu mặc định — cộng 9 font Google Fonts phổ biến)
  thay vì cho tải file font tuỳ ý — PRD §16 tự nêu rủi ro bản quyền font, nên
  Phase 1 chủ động không nhận file font chưa rõ giấy phép. Preset kích thước
  dùng chung toàn workspace (không gắn theo từng brand); Template thì gắn
  theo brand — xem comment đầu `0003_templates_presets.sql` để biết lý do.
- **Font chữ toàn ứng dụng — Aeonik Pro:** đây là font chính thức trong brand
  guideline của Creative Hub, self-host qua `next/font/local` trong
  `src/app/layout.tsx` (file `.otf` đã cấp phép đặt tại
  `public/fonts/aeonik-pro/`, xem README trong thư mục đó) và nạp vào token
  `--font-sans` / `--font-heading` trong `src/app/globals.css`. Mọi component
  dùng chung qua class `font-sans`/`font-heading`, không khai báo font riêng
  lẻ. Fallback là **Be Vietnam Pro** (hỗ trợ đầy đủ dấu tiếng Việt, vì Aeonik
  Pro chỉ có glyph Latin) — dùng khi một ký tự nào đó Aeonik Pro không có.
- "Mẫu banner" ở bước này chỉ lưu tên + preset kích thước — phần bố cục
  layer thật (vị trí logo/chữ) sẽ được chỉnh trực tiếp trong Trình chỉnh sửa
  banner (Task 4.0), không có UI riêng để nhập toạ độ tay ở Task 2.0.

## Sinh ảnh AI + chọn model + fallback (Task 3.0, mở rộng)

- **3 model thật đã được tích hợp** (gọi API thật từ server, không có giả
  lập): **Nano Banana Pro** (Google Gemini 3 Pro Image, `gemini-provider.ts`),
  **Higgsfield** (gọi REST trực tiếp bằng fetch, endpoint
  `/v1/text2image/soul` — schema đã xác minh trực tiếp với API thật qua 2
  lần gọi thử miễn phí (lỗi 422 validation, không tốn phí), **không** dùng
  SDK chính thức `@higgsfield/client` vì `subscribe()` của SDK gửi body
  sai định dạng cho đúng endpoint này (thiếu bọc `params`), và **không**
  dùng Higgsfield CLI cài sẵn trên máy này, vì CLI cần phiên
  `higgsfield auth login` cục bộ và không chạy được trên hosting
  serverless; `higgsfield-provider.ts`), **ChatGPT** (OpenAI Images API,
  `openai-provider.ts`). Xem biến môi trường cần thiết ở `.env.example`.
- **Mặc định (chưa cấu hình key nào): app chạy y hệt trước đây** — chỉ
  **Demo Provider** (ảnh placeholder SVG có nhãn "DEMO"), không model nào
  hiện trong dropdown "Model tạo ảnh" ngoài "Tự động chọn model". Một model
  chỉ xuất hiện trong UI khi env var tương ứng được set — `isConfigured()`
  tự kiểm tra, không có model nào "giả vờ khả dụng".
- **Fallback tự động**: `src/lib/generation/providers/index.ts` (thứ tự mặc
  định: Nano Banana Pro → Higgsfield → ChatGPT, đổi qua env
  `AI_FALLBACK_ORDER`, **không có UI admin riêng** — quyết định có chủ đích
  vì app chưa có màn hình admin-settings cấp workspace cho loại cấu hình
  này). Orchestrator nằm trong `generateImages()`
  (`src/lib/generation/actions.ts`): lỗi *có thể* thử model khác
  (`unavailable`/`timeout`/`rate_limited`/`quota_exceeded`) mới chuyển
  sang model kế tiếp; lỗi *không* thử lại (`invalid_request`/
  `content_policy`) dừng ngay, báo lỗi để người dùng sửa yêu cầu — không
  bao giờ âm thầm chuyển sang Demo khi model thật lỗi.
- Mỗi lần thử ghi vào `generation_jobs.attempts` (model, trạng thái, mã
  lỗi, thời gian) — `JobStatus`/`BannerSetupForm` đọc cột này để hiện
  "Đang thử X… / đang chuyển sang Y…" khi đang chạy, và trang chi tiết tài
  sản hiện model nào thực sự tạo ra kết quả (`requested_model` vs
  `final_model`, migration `0006_generation_model_fallback.sql`).
- **Idempotency**: double-click hoặc client gửi lại cùng request trong
  khoảng 15s tái sử dụng job đang chạy thay vì tạo job trùng (kiểm tra
  `user_id`+`brand_id`+`prompt`+`params` trước khi insert).
- Không có hàng đợi/worker nền thật ở Phase 1 — Server Action tạo job
  (`queued`) rồi xử lý **đồng bộ** ngay trong cùng request, kể cả toàn bộ
  chuỗi fallback (có thể mất tới ~1-2 phút nếu phải thử nhiều model) —
  chấp nhận được ở quy mô hiện tại, nhưng là điểm cần worker nền thật nếu
  sau này có nhiều model chậm hơn trong chuỗi fallback.
- Trạng thái job sống sót qua refresh nhờ query param `?job=<id>` — không
  phải chỉ dựa vào state React phía client.
- **Giới hạn độ dài prompt theo model** (`capabilities.maxPromptLength` ở
  từng `providers/*.ts`, đồng bộ sang client qua `model-meta.ts` —
  không có bảng giá trị rời rạc nào khác, tránh lệch frontend/backend):
  OpenAI **32.000 ký tự** (tài liệu chính thức công bố); Higgsfield
  **32.000 ký tự** (xác nhận trực tiếp bằng cách gửi prompt 32.000 ký tự
  tới API thật, kèm `width_and_height` cố ý sai để request vẫn miễn phí —
  không thấy lỗi độ dài nào, chỉ còn lỗi size); Gemini **32.000 ký tự**
  (suy luận từ kiến trúc token-context rất lớn của model, Google không
  công bố giới hạn ký tự cứng — chưa tự kiểm chứng trực tiếp vì môi
  trường này không có `GEMINI_API_KEY`). Form tự tính giới hạn hiệu lực
  theo model đang chọn (`effectiveMaxPromptLength`); khi chọn "Tự động",
  dùng mức **nhỏ nhất** trong các model đã cấu hình để không nhập thứ sẽ
  bị model nào đó trong chuỗi fallback từ chối.
- **Kích thước theo đúng model (Higgsfield):** `/v1/text2image/soul` chỉ
  nhận `width_and_height` thuộc đúng 16 giá trị cố định — xác nhận trực
  tiếp từ response lỗi 422 của API thật (không đoán, không chỉ đọc tài
  liệu), liệt kê đủ trong `providers/higgsfield-sizes.ts` — nguồn duy
  nhất cho cả `HiggsfieldSizePicker` (UI) và `higgsfield-provider.ts`
  (server), tránh lệch 2 nơi. Khi người dùng chọn model Higgsfield trong
  "Tạo ảnh" hoặc bước "Tạo ảnh nền bằng AI" của "Tạo banner", dropdown
  Kích thước tự đổi sang đúng 16 lựa chọn này (nhãn dạng "16:9 —
  2048×1152px"; 2 giá trị không rút gọn được tỉ lệ sạch — 960×1696 và
  1696×960 — ghi "Khác" thay vì bịa tỉ lệ gần đúng); đổi model sang/khỏi
  Higgsfield sẽ tự chọn lại kích thước gần đúng tỉ lệ nhất và báo rõ bằng
  toast, không giữ lựa chọn cũ không còn hợp lệ. Request gửi đúng
  `width_and_height` đã chọn (`exactSize` trong schema, tách khỏi
  `sizePresetId` chứ không suy luận ngược). Các model khác (Gemini,
  ChatGPT, Demo) giữ nguyên danh sách preset kích thước theo workspace
  như trước. Không có size tuỳ ý khi Higgsfield chạy qua nhánh "Tự động"
  hoặc fallback từ model khác: adapter chọn preset gần đúng tỉ lệ khung
  hình nhất và ghi rõ điều chỉnh này vào `attempts[].adjustments`.
- **Bug thật, đã sửa lần 2 (lần sửa đầu — field `status_url`/`request_id` —
  vẫn dựa trên tài liệu sai, không phải dữ liệu thật):** mọi lượt tạo ảnh
  Higgsfield thật trong phiên trước đều fail ở bước poll vì response
  THÀNH CÔNG thật của `/v1/text2image/soul` không có `status_url` **lẫn**
  `request_id` — xác nhận bằng một lượt submit thật, tốn phí, đọc thẳng
  body JSON (ngày 2026-10-24), có dạng:
  ```json
  { "id": "<job_set_id>", "type": "text2image_soul", "created_at": "...",
    "jobs": [{ "id": "<job_id>", "status": "queued", "results": null }],
    "input_params": { ... } }
  ```
  Code cũ không thấy cả hai field nên luôn throw "không trả về
  request_id/status_url hợp lệ" — đúng là log server đã bắt được, không
  phải đoán. Endpoint poll thật (xác nhận bằng cùng job set, cũng tốn phí
  thật): `GET /v1/job-sets/{id}` (không phải `status_url`), trả lại cùng
  shape, khi `jobs[0].status === "completed"` thì ảnh nằm ở
  `jobs[0].results.raw.url` (bản đầy đủ) hoặc `.min.url` (bản preview nhỏ
  hơn) — không phải `images[0].url` như tài liệu endpoint khác. Đã tải
  ảnh `raw` thật về và đọc header PNG: đúng khớp pixel với
  `width_and_height` đã gửi (1536×1152 gửi → 1536×1152 thật), nên
  `higgsfield-provider.ts` **không cần resize/crop phía server** cho
  provider này — chỉ cần luôn gửi đúng 1 trong 16 giá trị enum hợp lệ
  (đã vậy từ trước). Để tự bảo đảm thay vì tin lại request size,
  `fetchAsImage()` giờ đọc kích thước THẬT từ byte ảnh tải về
  (`src/lib/generation/image-dimensions.ts`, tự phân tích header
  PNG/JPEG/WebP, không dùng thư viện ngoài) rồi mới lưu — nếu một lúc nào
  đó Higgsfield đổi hành vi và trả sai kích thước, hệ thống sẽ lưu đúng
  kích thước thật chứ không lặp lại lỗi "tin vào request size" của bản
  trước.
  Phát hiện thêm trong cùng lần probe: `enhance_prompt` (mặc định `true`)
  **viết lại prompt phía server** mà không báo — `input_params.prompt`
  trả về sau khi hoàn tất khác hẳn prompt đã gửi. Đã set
  `enhance_prompt: false` để prompt thực sự dùng là prompt người dùng gõ,
  không bị âm thầm thay.
  Lỗi hiển thị cho người dùng cũng được tách theo nhóm nguyên nhân thay vì
  luôn 1 câu chung (`buildExhaustedChainMessage` trong `actions.ts`):
  không kết nối được provider / hết thời gian chờ / bị giới hạn tốc độ /
  hết hạn mức — mỗi nhóm kèm message gốc của provider (đã lọc secret) để
  còn gỡ lỗi tiếp được từ UI thay vì chỉ đọc log.
- Model id mặc định của OpenAI
  (`OPENAI_IMAGE_MODEL`, mặc định `gpt-image-1`) nên được xác minh lại với
  tài liệu OpenAI hiện hành trước khi dùng production — trang docs lúc
  tra cứu có nhắc tới các id dạng preview chưa xác nhận chéo được. Ảnh tải
  lên (Task 3.10) không tự đọc được width/height thật (dự án không dùng
  thư viện xử lý ảnh phía server theo chủ đích — xem lý do Demo Provider
  dùng SVG thay vì ảnh raster); ảnh do Higgsfield SINH RA thì từ bản sửa
  này đã đọc được kích thước thật (xem phần ngay trên).

## Higgsfield Marketing Studio Image — model thứ 2 trên nền Higgsfield

Một model RIÊNG, khác hẳn Higgsfield Soul ở trên — endpoint, body, response
đều khác, không dùng chung code path, chỉ dùng chung `HF_CREDENTIALS`. Mọi
chi tiết dưới đây xác minh trực tiếp trên API thật (free validation-error
probe + vài lượt submit thật, có tính phí) ngày 2026-10-24, không lấy từ
tài liệu công khai (tài liệu đó thiếu hẳn phần response/status).

- `src/lib/generation/providers/marketing-studio-provider.ts` — id
  `higgsfield-marketing-studio`, label "Higgsfield Marketing Studio".
  ```
  POST https://api.higgsfield.ai/marketing-studio/image
  { prompt, resolution: "1k"|"2k"|"4k", aspect_ratio: "auto"|"1:1"|"3:2"|
    "2:3"|"4:3"|"3:4"|"16:9"|"9:16"|"21:9", enhance_prompt: boolean,
    image_urls?: string[], preset_id?: string }
  -> { status, request_id, status_url, cancel_url, expires_after }
  poll GET status_url -> { status, images?: [{url}], error? }
  ```
  Trái với Higgsfield Soul (field `status_url` KHÔNG tồn tại ở response
  thật — xem mục trên), response của Marketing Studio THỰC SỰ có
  `status_url`/`request_id` — xác nhận bằng cách đọc body JSON từ một
  lượt submit thật.
- **Chế độ Direct** (`enhance_prompt: false`, mặc định): chỉ cần `prompt`
  + `resolution` + `aspect_ratio`; `image_urls` (0-2 ảnh) tuỳ chọn, dùng
  để "chỉnh ảnh" dựa trên ảnh có sẵn.
- **Chế độ Enhance** (`enhance_prompt: true`): bắt buộc `preset_id` (lấy
  từ `GET /marketing-studio/image/presets?size=&cursor=`, không hard-code
  — tài liệu cảnh báo preset có thể đổi) và `image_urls` có ít nhất 1 ảnh
  (ảnh sản phẩm). Xác nhận trực tiếp bằng 400 "preset_id is a required
  property" / "image_urls is a required property" khi thiếu. Tối đa 2 ảnh
  tham chiếu — gửi 3 ảnh bị từ chối thật ("is too long"), gửi 2 ảnh được
  chấp nhận (ảnh đầu = sản phẩm, ảnh thứ 2 = mẫu/style, theo đúng tài
  liệu).
- **Không có bảo đảm kích thước pixel theo tier** (khác Higgsfield Soul,
  model này không nhận width/height) — chỉ xác minh được `resolution:
  "1k"` + `aspect_ratio: "1:1"` cho ra ảnh thật 1024×1024. Vì vậy UI
  KHÔNG hiển thị số pixel cho từng tổ hợp tier/tỷ lệ (đúng yêu cầu "không
  tự thêm kích thước pixel nếu API không đảm bảo"), và kích thước THẬT
  lưu vào `creative_assets` luôn được đọc từ byte ảnh tải về
  (`image-dimensions.ts`), không suy ra từ tier.
- `enhance_prompt` ở ĐÂY là tham số yêu cầu preset, khác với
  `enhance_prompt` của Higgsfield Soul (vốn tự viết lại prompt, đã tắt ở
  Soul) — hai field cùng tên nhưng ý nghĩa khác nhau giữa 2 endpoint,
  không dùng nhầm sang nhau.
- Model này **không** nằm trong chuỗi fallback mặc định của "Tự động"
  (`providers/index.ts`): tham số aspect_ratio/resolution không thể suy ra
  an toàn từ width/height của model khác, nên chỉ chạy khi người dùng
  chọn đích danh.
- Composer (`image-composer.tsx`) hiển thị `AspectRatioPicker` +
  `ResolutionPicker` (9 tỷ lệ × 3 tier, mỗi tỷ lệ có icon khung hình) thay
  cho size-preset picker khi model này được chọn; nút "Reference"/"@
  Elements" cho phép tối đa 2 ảnh (`reference-picker.tsx` đã tổng quát
  hoá từ 1 lên N ảnh, dùng chung cho cả Soul lẫn Marketing Studio); công
  tắc "Enhance theo preset" chỉ hiện khi model hỗ trợ, tải preset thật qua
  Server Action `getMarketingStudioPresets` (`enhance-preset-picker.tsx`).
- **Chưa xác minh được**: hành vi chế độ Direct với >2 `image_urls` (một
  probe thật với 4 URL giả đã được server CHẤP NHẬN ở bước validate, khác
  với giới hạn 2 đã xác nhận của chế độ Enhance) — UI vẫn chốt tối đa 2
  cho cả 2 chế độ để không dựa vào một giới hạn chưa kiểm chứng kỹ; thời
  gian poll thực tế cho ảnh 4K (chưa thử trong phiên này, chỉ thử 1K) có
  thể vượt `POLL_TIMEOUT_MS` hiện tại (60s) hoặc giới hạn thời gian của
  Server Action trên production — rủi ro có sẵn từ kiến trúc "không có
  worker nền" (xem Task 3.0), không phải lỗi riêng của model này.

## Trang Tạo ảnh — composer + gallery (nâng cấp UI)

- `src/components/generate/image-composer.tsx` thay cho form cũ
  (`image-generate-form.tsx` đã xoá): prompt + toolbar (Reference,
  Elements, kích thước, model, số lượng) trong 1 composer gọn, nút "Tạo
  ảnh" cạnh composer. Không còn trường Thương hiệu (xem mục trên).
- **Reference**: tải ảnh lên qua `uploadReferenceImage()` (lưu Storage
  dưới `_reference/`, **không** tạo dòng `creative_assets` — ảnh tham
  chiếu là input, không phải sản phẩm, nên không lọt vào Thư viện), trả về
  signed URL truyền thẳng vào `genParams.referenceImageUrl`.
- **@ Elements**: không phải hệ thống multi-mention thật — API Higgsfield
  chỉ có **đúng 1** tham số `image_reference` (xác nhận trực tiếp: gửi
  `image_reference.image_url` sai định dạng, lỗi `422` trả về chỉ rõ tên
  field này, không phải đoán). Nên "Elements" chỉ là **lối vào thứ 2** của
  cùng 1 ô tham chiếu đó — chọn 1 ảnh có sẵn trong Thư viện
  (`resolveAssetAsReference()`) thay vì tải file mới. Chọn phần tử thứ 2
  sẽ **thay thế** phần tử trước, không cộng dồn.
- Reference/Elements chỉ bật khi model đang chọn là Higgsfield (hoặc "Tự
  động") — `capabilities.supportsReferenceImage` kiểm tra per-model, disable
  + giải thích rõ khi model không hỗ trợ, không hiện nút giả.
- Gallery dưới composer đọc từ `getGeneratedImageGallery()` (query mới,
  tách riêng khỏi `getLibraryAssets`/Thư viện để không ảnh hưởng trang đó)
  — chỉ liệt kê `creative_assets` có `source_generation_job_id` (ảnh sinh
  ra thật, không phải ảnh tải lên tay), mới nhất trước.
- **Auto-save**: khác với luồng cũ (phải bấm "Lưu" từng ảnh), ảnh tạo
  thành công giờ **tự động lưu** vào `creative_assets` ngay sau khi job
  hoàn tất (gọi `saveGenerationResult()` cho từng kết quả không phải
  demo) — đúng tinh thần "ảnh tạo ra xuất hiện ngay thành gallery" của
  thiết kế mới.
- **"Tạo biến thể"**: điền lại prompt/model/kích thước của 1 ảnh cũ vào
  composer để người dùng chỉnh và tạo lại — hành vi client-side thuần
  (không gọi API nào mới), không phải tính năng "biến thể tự động từ ảnh
  gốc" (API không có khả năng đó).
- **Giới hạn đã biết:** bỏ URL `?job=<id>` khôi phục trạng thái sau khi
  refresh (tính năng có ở form cũ) — thiết kế composer mới không còn gắn
  với 1 job cụ thể qua URL; job đang chạy chỉ theo dõi được trong phiên
  trình duyệt hiện tại (vẫn khôi phục được qua Dashboard → "Tác vụ chưa
  hoàn tất" nếu còn `queued`/`processing`). Chưa xác minh được
  `image_reference` hoạt động với ảnh thật (chỉ xác nhận field có tồn
  tại qua lỗi `422`, không gọi generation thật để tránh tốn phí).

## Trình chỉnh sửa banner (Task 4.0)

- Canvas dựng bằng `react-konva` (đã quyết định từ Task 1.0) — layer
  background/image/logo/text/shape, chọn bằng click, resize/xoay qua
  Konva Transformer, kéo thả để di chuyển.
- Mỗi lần "Lưu" tạo **version mới** trong `design_documents` (không sửa đè,
  đúng nguyên tắc PRD) và cập nhật `creative_assets.current_design_document_id`.
  "Xuất" luôn lưu trước nếu còn thay đổi chưa lưu, để file export không bao
  giờ lệch với nội dung đang hiển thị.
- Xuất ảnh chạy hoàn toàn phía **client** qua `Stage.toDataURL()` của Konva
  ở `pixelRatio` tương ứng độ phân giải gốc — không cần cài thư viện xử lý
  ảnh phía server (nhất quán với cách Demo Provider ở Task 3.0 dùng SVG
  thay vì raster).
- Engine kiểm tra guideline (`src/lib/design/guideline-check.ts`) là hàm
  thuần, dễ kiểm chứng độc lập — 7 tiêu chí, mỗi tiêu chí ghi rõ lý do dựa
  trên toạ độ/màu/font thật của layer, không đoán.
- **Giới hạn đã biết:**
  - Admin **chưa có UI** để tự chọn check nào chặn xuất (PRD §8.5 có nhắc
    tới khả năng này) — Phase 1 cứng hoá đúng 2 mặc định PRD tự nêu (sai
    kích thước, thiếu logo chặn xuất; còn lại chỉ cảnh báo).
  - Chưa có "đường căn" thông minh (snap-to-align giữa các layer khi kéo) —
    chỉ có lưới (grid) và khung vùng an toàn để căn bằng mắt.
  - Ảnh tải lên không tự đọc width/height thật (xem giới hạn ở Task 3.0) —
    không ảnh hưởng canvas (layer luôn co giãn theo preset), chỉ ảnh hưởng
    metadata hiển thị trong thư viện.
  - Logic kiểm tra "màu/font thuộc cấu hình" so khớp chính xác theo mã hex/
    tên font — không phát hiện các biến thể gần đúng (vd: #FFFFFF vs
    #FEFEFE).
  - Lớp đang ẩn (`visible: false`) vẫn được tính vào các kiểm tra guideline
    (tràn khung, màu/font ngoài cấu hình) dù sẽ không xuất hiện khi xuất
    file — hành vi có từ trước khi thêm tính năng ẩn/hiện lớp, chưa sửa
    trong lượt này vì không nằm trong yêu cầu.

### Tạo hình ảnh bằng AI dựa trên nền + Nội dung chữ (Tagline/Subtitle)

- **Tạo hình ảnh bằng AI trong editor** (`ai-image-panel.tsx`, nút trên
  toolbar, chỉ bật khi banner đã có ảnh nền) — nâng cấp lần 2 (2026-10-25):
  ảnh tạo ra giờ luôn **vuông 1:1** và có **nền trong suốt thật** (alpha
  channel thật, không phải giả lập), với thanh **Feather** chỉnh được cả
  trước lẫn SAU khi đặt lên banner. Xem chi tiết kỹ thuật ở mục riêng ngay
  dưới đây (quan trọng: thuật toán tách nền ban đầu bị lỗi thật trên dữ
  liệu thật, đã sửa và xác minh lại).
  - Bắt buộc dùng **Marketing Studio** (chế độ direct/edit, `aspect_ratio:
    "1:1"`, `resolution: "1k"` — tổ hợp DUY NHẤT đã xác nhận thật cho ra
    ảnh đúng 1024×1024) — Soul không có trong danh sách 16 kích thước của
    nó một lựa chọn vuông nhỏ đáng tin cậy tương đương, nên không dùng làm
    fallback cho tính năng này nữa.
  - Dùng lại đúng `generateImages`/`getGenerationJobAction` của luồng Tạo
    ảnh, cùng `HF_CREDENTIALS` phía server — không thêm provider/API key
    thứ hai, không gọi dịch vụ tách nền bên thứ ba, không upload ảnh người
    dùng đi đâu ngoài Supabase Storage của chính app.
  - Ảnh thô từ Higgsfield (không alpha) được tải về và xử lý **hoàn toàn
    phía trình duyệt** bằng Canvas 2D (`lib/image-processing/
    background-removal.ts`) — không cần provider/thư viện ảnh phía
    server. Người dùng xem preview trên cả nền caro lẫn nền banner thật
    trước khi quyết định.
  - Chỉ khi bấm **"Đặt lên banner"** mới upload file PNG-có-alpha đã xử lý
    qua `uploadImageAsset` (mở rộng để nhận `prompt`/trả thêm `path`) rồi
    thêm một **layer "image" mới** (scale tối đa 60% canvas, giữ tỷ lệ
    vuông, căn giữa, `featherPx` ghi vào layer) — nền gốc không bị động
    tới, layer mới kéo/resize/xoá/ẩn-hiện như mọi layer ảnh khác.
  - **Feather SAU khi đặt vẫn chỉnh sống được**: file lưu trữ luôn là bản
    **mép cứng** (feather=0); canvas tự tính lại alpha mềm mỗi khi
    `featherPx` của layer đổi (`use-feathered-image.ts`, đọc lại alpha gốc
    từ chính ảnh đã lưu rồi áp box-blur riêng cho alpha — không đụng tới
    RGB nên không mất chi tiết chủ thể) — xuất banner (`Stage.toDataURL`)
    vì vậy luôn khớp với preview đang thấy.
  - **Không tách nền đáng tin cậy** (tỷ lệ nền phát hiện được <3% hoặc
    >97%) thì báo lỗi rõ ràng, có nút "Đặt ảnh không trong suốt lên
    banner" làm phương án dự phòng đã nói rõ KHÔNG trong suốt — không bao
    giờ tự nhận ảnh có alpha khi không có.
  - Trước khi chạy heuristic, code kiểm tra bytes PNG gốc có thật sự có
    alpha channel không (`pngHasAlphaChannel`, đọc byte color-type của
    IHDR) + có pixel nào thật sự trong suốt không (`hasRealTransparency`)
    — nếu provider tự trả alpha thật (hiện tại Higgsfield thì không,
    nhưng code không giả định điều đó mãi đúng), dùng luôn alpha đó, bỏ
    qua bước tách nền nội bộ.
  - Chống submit trùng bằng cách disable nút trong lúc đang xử lý (gộp cả
    3 giai đoạn generating/segmenting/placing vào một cờ `busy`), và cơ
    chế chống trùng request 15 giây sẵn có của `generateImages` (Task 3.0)
    vẫn áp dụng.

#### Tách nền cục bộ — thuật toán thật, đã sửa 1 lỗi thật trên dữ liệu thật

Xác minh trực tiếp trên API thật ngày 2026-10-25: Marketing Studio trả về
PNG **color type 2 (RGB, không có alpha)** ngay cả khi prompt yêu cầu rõ
"chủ thể tách biệt trên nền trắng trơn" — API không có tham số
`transparent background` nào trong schema thật. Vì vậy mọi lớp trong suốt
trong app này đều phải tự tính bằng pixel thật, không có đường tắt từ
provider.

- **Lần thử đầu tiên sai, phát hiện bằng cách chạy thật trên 1 ảnh thật**
  (giày thể thao đỏ trên nền trắng, do chính Marketing Studio tạo): flood
  fill so màu MỖI PIXEL với pixel LÂN CẬN đã được nhận là nền (loang dần)
  — trên ảnh thật, vùng bóng đổ/anti-alias mờ dần giữa nền trắng và chủ
  thể đỏ đủ mịn để thuật toán "lách" xuyên suốt, kết quả đo được là
  **99.8% ảnh bị coi là nền** (gần như xoá sạch chủ thể). Lỗi này được
  phát hiện bằng script Node chạy thật (dùng gói `sharp` có sẵn trong
  `node_modules` như một transitive dependency của Next.js, chỉ để kiểm
  tra ngay trong phiên làm việc — KHÔNG phải dependency của sản phẩm,
  không được import ở bất kỳ đâu trong `src/`).
- **Đã sửa**: so màu mỗi pixel với một màu nền THAM CHIẾU CỐ ĐỊNH (trung
  bình màu toàn bộ viền ảnh), chỉ dùng BFS để giữ tính liên thông từ viền
  vào (không lan màu dựa trên pixel lân cận nữa). Chạy lại đúng ảnh giày
  đỏ đó: tỷ lệ nền ổn định quanh **74.6%** với ngưỡng màu từ 20 đến 100
  (không nhạy ngưỡng — dấu hiệu của một đường biên thật, không phải loang
  lỗi), chủ thể giữ nguyên vẹn, alpha nền = 0 và alpha chủ thể = 255 đã
  kiểm tra trực tiếp trên từng pixel đầu ra.
- Hàm feather (`featherMask`) cũng được xác minh bằng dữ liệu thật: với
  feather=16px, biên lấy mẫu dọc theo 1 hàng pixel cho dải giá trị alpha
  tăng dần mượt từ ~33 đến ~227 trong một cửa sổ 40px quanh biên, trong
  khi nội tâm chủ thể (alpha=255) và nền xa (alpha=0) giữ nguyên không
  đổi — đúng như kỳ vọng "chỉ mềm biên, không mất chi tiết, không mờ toàn
  ảnh".
- **Giới hạn thật của phương pháp này** (không phải ML/neural segmentation):
  hoạt động tốt khi nền do AI tạo ra tương đối đơn sắc/trơn (đúng như
  prompt gợi ý trong UI: "nên mô tả thêm nền đơn giản/trơn"); nền phức
  tạp, nhiều màu, hoặc chủ thể có vùng màu trùng với nền và chạm viền ảnh
  vẫn có thể cho kết quả không đáng tin — trường hợp đó được phát hiện
  (tỷ lệ nền bất thường) và báo rõ cho người dùng, không bao giờ âm thầm
  trả về một ảnh "trong suốt" giả.
- **Nội dung chữ — Tagline/Subtitle** (`text-content-panel.tsx`): 2 ô
  nhập, mỗi ô ánh xạ đúng 1 text layer qua field mới
  `DesignLayer.role: "tagline" | "subtitle"` (bổ sung, không phá
  `DesignLayer` cũ) — gõ tạo layer ở lần gõ đầu tiên (không bao giờ tự
  chèn nội dung giả), xoá hẳn trống thì layer bị xoá khỏi danh sách thay
  vì để lại một layer chữ rỗng. Style riêng (font, cỡ chữ, màu, độ đậm,
  căn lề, line-height, letter-spacing) dùng lại nguyên `TextProperties`
  đã có — bấm icon bút ở panel Nội dung chữ để chọn đúng layer rồi chỉnh.
  Vị trí mặc định đặt trong vùng an toàn phía dưới canvas; có thể kéo thả
  lại như layer bất kỳ. Nội dung lưu trong `design_documents.layers`
  (jsonb) như mọi layer khác — mở lại vẫn sửa được, không rasterize vào
  ảnh nền.
- **Ẩn/hiện layer** (mọi loại, không riêng tagline/subtitle): field mới
  `DesignLayer.visible` (mặc định coi như `true` khi vắng mặt, tương thích
  ngược với mọi banner đã lưu trước đây) — icon mắt trong panel Lớp,
  canvas bỏ qua hoàn toàn render (không chỉ opacity 0) khi `visible ===
  false` nên không thể bấm trúng/kéo nhầm một layer đang ẩn.
- Cả 2 field mới (`role`, `visible`) đã được thêm vào
  `saveDesignDocumentSchema` (`src/lib/design/schema.ts`) — thiếu bước này
  sẽ khiến Zod âm thầm loại bỏ 2 field khi lưu, mất trạng thái ẩn/hiện và
  mất liên kết tagline/subtitle ngay sau lần tải lại trang đầu tiên; đã
  kiểm tra kỹ vì đây là lỗi dễ bỏ sót khi thêm field mới vào một jsonb đã
  có schema validate riêng.
- **Chưa thể xác minh do thiếu quyền truy cập trình duyệt**: thuật toán
  tách nền/feather đã chạy thật và kiểm tra pixel-by-pixel bằng Node +
  `sharp` ngoài trình duyệt (xem mục ngay trên) — đó là bằng chứng mạnh
  rằng công thức ĐÚNG, nhưng chưa chạy được đúng bản `background-removal.ts`
  (TypeScript, Canvas 2D API của trình duyệt) bên trong chính ứng dụng:
  chưa mở dialog thật, chưa bấm "Tạo ảnh", chưa kéo thanh Feather bằng
  chuột, chưa xác nhận CORS của Supabase Storage signed URL cho phép
  `canvas.getImageData()` không bị "tainted" trong trình duyệt thật (code
  đã bắt lỗi này rõ ràng nếu xảy ra, nhưng chưa quan sát được thực tế) —
  không có công cụ điều khiển trình duyệt trong môi trường này.

### Logo mặc định, vị trí Tagline theo logo, màu chữ theo guideline

- **Vị trí logo mặc định**: 60px cách trái, 60px cách trên, cao đúng 48px,
  rộng theo **tỷ lệ thật** của file logo — đọc trực tiếp từ byte ảnh
  (`src/lib/generation/image-dimensions.ts`, đã mở rộng thêm nhánh đọc
  SVG qua `width`/`height`/`viewBox` bằng regex, vì logo thương hiệu rất
  hay là SVG và 3 nhánh PNG/JPEG/WebP cũ không đọc được SVG). Áp dụng ở
  cả 2 nơi logo có thể được đặt: lúc tạo banner lần đầu
  (`createBannerAsset` — đọc bytes thật qua `downloadBrandAsset` mới thêm
  ở `lib/brand/storage.ts`) và lúc chọn lại phiên bản logo trong editor
  (`applyLogoVariant` ở `editor-shell.tsx` — đọc `naturalWidth/
  naturalHeight` qua `Image()` của trình duyệt, cũng áp dụng được cho
  SVG). Không còn ép logo thành hình vuông như mặc định cũ (15% chiều
  rộng canvas, méo tỷ lệ với logo không vuông).
- **Hai phiên bản logo**: guideline vốn có 4 slot (`primary/secondary/
  light/dark`), không có slot tên "trắng" riêng — "Logo màu" map vào
  `primary` (logo chính), "Logo trắng" map vào `dark` ("Biến thể nền tối",
  theo đúng chủ đích slot này là logo dùng TRÊN nền tối, thường là bản
  trắng/đơn sắc). Đây là một lựa chọn ánh xạ dựa trên schema sẵn có, nêu
  rõ ở comment đầu `logo-panel.tsx` để dễ sửa nếu không khớp với cách
  thương hiệu cụ thể đang dùng 2 slot đó. Thiếu slot nào thì panel hiện
  tile "Chưa có" kèm hướng dẫn tải lên ở Thương hiệu → Guideline, không
  tự thay bằng logo khác.
- **Tagline cách đáy logo đúng 170px** theo toạ độ canvas thật (không phải
  pixel màn hình preview) — tính từ `logoLayer.y + logoLayer.height +
  170`, chỉ rơi về vị trí tỉ lệ cũ khi banner chưa có logo. Subtitle mặc
  định nối tiếp ngay dưới Tagline (+16px).
- **Swatch màu guideline** thêm vào `TextProperties` (panel "Thuộc tính
  chữ" đã có sẵn từ trước) — các ô tròn màu từ `guideline.colors`, bấm để
  gán ngay `layer.color`; color picker + ô nhập HEX tự do vẫn giữ nguyên
  bên dưới. Màu lưu thẳng trong `DesignLayer.color` (đã có từ trước),
  không cần thay đổi schema.
- **Kiểm tra guideline "Có logo"** giờ đòi hỏi layer logo phải có
  `imagePath` thật mới tính là "Đạt" (trước đây chỉ cần tồn tại layer type
  "logo", kể cả khi chưa gán ảnh nào) — tránh báo đạt sai.
- Việc nhận diện chữ tràn khung vẫn dùng đúng check "Chữ không tràn
  khung" có sẵn từ Task 4.0 (so khung layer với canvas) — **chưa** đo
  chiều cao chữ thực tế sau khi Konva tự xuống dòng so với `height` khai
  báo của layer; Konva Text mặc định tự wrap theo `width` và không cắt
  chữ (không có `wrap="none"` hay clip nào được cấu hình), nên nội dung
  dài tự xuống dòng đúng yêu cầu "không cắt chữ âm thầm", chỉ là cảnh báo
  tràn khung hiện tại chưa tinh tới mức đo chiều cao sau wrap.
- **Chưa thể xác minh do thiếu quyền truy cập trình duyệt**: chưa thực sự
  mở editor, chọn logo màu/trắng, gõ Tagline/Subtitle và xuất file để xem
  bằng mắt kết quả — chỉ xác minh qua đọc code và `tsc`/`eslint`/
  `npm run build` (đều sạch).

## Dashboard và thư viện tài sản (Task 5.0)

- Tìm kiếm trong thư viện dùng chung một ô cho tên/prompt/chiến dịch (ILIKE,
  có sanitize ký tự đặc biệt của PostgREST `.or()` — cùng quy ước đã dùng ở
  mọi ô tìm kiếm khác trong app).
- Phân trang bằng query param URL (`?page=`), luôn kèm `{ count: "exact" }`
  trong cùng 1 query — không có query đếm riêng, không tải toàn bộ bảng.
- Phân tích sự kiện (`src/lib/analytics/track.ts`) ghi đủ 10 sự kiện PRD
  §14, nhưng **chưa nối nhà cung cấp analytics thật** (PostHog/Segment/...) —
  hiện chỉ `console.log` có cấu trúc phía server làm sink tạm, dễ thay thế vì
  mọi lời gọi đều đi qua đúng 1 hàm `trackEvent()`.
- **Giới hạn đã biết:**
  - Thư viện chỉ có chế độ lưới (grid), chưa có chế độ danh sách (list/table)
    như PRD §8.6 có nhắc tới.
  - Lọc theo "người tạo" có nhưng theo khoảng ngày (date range) thì chưa —
    chiến dịch được gộp vào ô tìm kiếm chung thay vì một dropdown riêng.
  - Xoá tài sản là xoá thật (hard delete) kèm dọn file Storage, không phải
    soft-delete/thùng rác — PRD §7.4 chỉ yêu cầu "phản ánh trạng thái đã
    xoá", không bắt buộc khôi phục được.

## Cấu trúc thư mục chính

```
src/
├── app/
│   ├── (app)/            # Mọi route cần đăng nhập, dùng chung AppShell
│   │   ├── dashboard/
│   │   ├── create/{image,banner}/
│   │   ├── library/
│   │   ├── brands/       # Admin-only
│   │   ├── members/      # Admin-only
│   │   └── settings/
│   ├── login/, register/
│   └── layout.tsx
├── components/
│   ├── ui/                # shadcn primitives
│   ├── auth/, layout/, workspace/
├── lib/
│   ├── supabase/{client,server,admin,middleware}.ts
│   ├── auth/, workspace/
└── types/
supabase/migrations/        # Chạy thủ công trên Supabase, theo thứ tự số
tasks/                       # PRD + task list nguồn
```

## Trạng thái các lát cắt (Task 0-5 trong `tasks/tasks-creative-hub.md`)

- [x] 0.0 Khởi tạo repo, feature branch
- [x] 1.0 Scaffold dự án, xác thực, quản lý thành viên, app shell
- [x] 2.0 Quản lý thương hiệu và brand guideline
- [x] 3.0 Sinh ảnh AI
- [x] 4.0 Trình chỉnh sửa banner
- [x] 5.0 Dashboard và thư viện tài sản

**Cả 5 task của Phase 1 đã hoàn thành theo kế hoạch trong `tasks/tasks-creative-hub.md`.**
Xem mục "Giới hạn đã biết" trong từng phần README phía trên để biết chính
xác những gì chưa làm hoặc làm tối giản so với PRD gốc — không có gì được
âm thầm bỏ qua mà không ghi chú.

Mỗi mục trên khi hoàn thành sẽ cập nhật lại README này cùng biến môi trường
mới nếu có.
