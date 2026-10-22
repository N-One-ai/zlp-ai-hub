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

## Thương hiệu & brand guideline (Task 2.0)

- Mỗi brand chỉnh sửa guideline lưu một **version mới** mỗi lần lưu (không
  sửa đè) — `brands.current_guideline_version_id` luôn trỏ tới version mới
  nhất. Cơ chế này chuẩn bị sẵn cho PRD §8.2: tài sản tạo ra sau này sẽ
  snapshot version đang hiện hành tại thời điểm tạo (nối vào Task 3.0+).
- Logo và avatar thương hiệu lưu trong bucket Storage **private**
  `brand-assets` (không public URL) — mọi hiển thị đi qua signed URL có hạn
  1 giờ, tự tạo lại mỗi lần tải trang, luôn tôn trọng RLS của người xem.
- **Giới hạn đã biết:** Font chọn từ danh sách cố định (`src/lib/brand/fonts.ts`,
  9 font Google Fonts phổ biến) thay vì cho tải file font tuỳ ý — PRD §16 tự
  nêu rủi ro bản quyền font, nên Phase 1 chủ động không nhận file font chưa
  rõ giấy phép. Preset kích thước dùng chung toàn workspace (không gắn theo
  từng brand); Template thì gắn theo brand — xem comment đầu
  `0003_templates_presets.sql` để biết lý do.
- "Mẫu banner" ở bước này chỉ lưu tên + preset kích thước — phần bố cục
  layer thật (vị trí logo/chữ) sẽ được chỉnh trực tiếp trong Trình chỉnh sửa
  banner (Task 4.0), không có UI riêng để nhập toạ độ tay ở Task 2.0.

## Sinh ảnh AI (Task 3.0)

- `getImageProvider()` (`src/lib/generation/providers/index.ts`) luôn trả
  **Demo Provider** hiện tại — tạo ảnh placeholder SVG có nhãn "DEMO" rõ ràng
  thay vì ảnh AI thật, đúng yêu cầu PRD "không tuyên bố sinh ảnh thật nếu
  provider chưa được cấu hình". Thêm provider thật = implement interface
  `AIImageProvider` (`providers/types.ts`) và đổi factory, không cần sửa gì ở
  Server Action/UI phía trên.
- Máy này đã có sẵn **Higgsfield CLI** (dùng trong project
  "ZaloPay AI Creative Platform" ở `~/AI-Design-Critic-Agent`) — một lựa chọn
  khả thi cho provider thật, nhưng **chưa được nối vào** vì không nằm trong
  phạm vi PRD này và chưa được yêu cầu rõ ràng.
- Không có hàng đợi/worker nền thật ở Phase 1 — Server Action tạo job
  (`queued`) rồi xử lý **đồng bộ** ngay trong cùng request
  (`processing` → `succeeded`/`failed`). Kiến trúc DB/UI đã đúng chuẩn cho
  khi nối provider thật chạy chậm hơn (10-90 giây) sau này, chỉ cần thay
  provider, không cần đổi schema.
- Trạng thái job sống sót qua refresh nhờ query param `?job=<id>` — không
  phải chỉ dựa vào state React phía client.
- **Giới hạn đã biết:** không có idempotency key chống việc 1 request bị
  gửi trùng do lỗi mạng/retry (chỉ chặn double-click phía client qua disable
  nút khi đang xử lý). Ảnh tải lên (Task 3.10) không tự đọc được
  width/height thật (dự án không dùng thư viện xử lý ảnh phía server theo
  chủ đích — xem lý do Demo Provider dùng SVG thay vì ảnh raster).

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
