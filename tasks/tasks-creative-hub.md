## Relevant Files

Stack: Next.js (App Router, TypeScript) + Supabase (Auth/Postgres/Storage/RLS) + Tailwind + shadcn/ui + `react-konva` (canvas editor). Danh sách dưới đây là các file cốt lõi dự kiến — sẽ còn phát sinh thêm trong quá trình implement từng sub-task.

- `README.md` - Quyết định stack, biến môi trường, hướng dẫn chạy local; cập nhật sau mỗi lát cắt.
- `.env.example` - Toàn bộ biến môi trường cần thiết (Supabase, AI provider key, v.v.), không chứa giá trị thật.
- `src/proxy.ts` - Middleware: refresh session, bảo vệ route theo xác thực.
- `src/lib/supabase/server.ts`, `client.ts`, `admin.ts`, `middleware.ts` - Các Supabase client theo đúng ranh giới (RLS-scoped vs service-role server-only).
- `supabase/migrations/0001_init_workspaces_profiles.sql` - profiles, workspaces, memberships (role), RLS.
- `supabase/migrations/0002_brands_guidelines.sql` - brands, brand_guideline_versions.
- `supabase/migrations/0003_templates_presets.sql` - size_presets, templates.
- `supabase/migrations/0004_generation_jobs.sql` - generation_jobs (status, provider, params, output).
- `supabase/migrations/0005_creative_assets_design_documents.sql` - creative_assets, design_documents.
- `supabase/migrations/0006_exports.sql` - exports.
- `src/lib/auth/actions.ts` - Đăng nhập/đăng xuất, xử lý phiên.
- `src/lib/workspace/queries.ts`, `actions.ts` - Đọc/ghi workspace, membership, kiểm tra quyền phía server (dùng lại ở mọi module khác).
- `src/lib/brand/queries.ts`, `actions.ts`, `schema.ts` - CRUD thương hiệu, guideline version, validate input (Zod).
- `src/lib/generation/providers/types.ts` - Interface adapter AI provider.
- `src/lib/generation/providers/demo-provider.ts` - Provider demo (placeholder có nhãn, dùng khi chưa cấu hình key thật).
- `src/lib/generation/actions.ts`, `queries.ts` - Tạo/poll generation job.
- `src/lib/editor/guideline-check.ts` - Engine kiểm tra guideline (kích thước, logo, vùng an toàn, màu/font, tràn chữ).
- `src/lib/assets/queries.ts`, `actions.ts` - Thư viện tài sản: tìm kiếm/lọc/phân trang, tải xuống, xóa.
- `src/lib/export/render.ts` - Render design document → PNG/JPG.
- `src/components/layout/app-shell.tsx`, `sidebar.tsx`, `mobile-nav.tsx` - Khung ứng dụng responsive.
- `src/components/brand/*` - Form thương hiệu, color picker, font picker, preset/template manager.
- `src/components/generate/image-generate-form.tsx`, `job-status.tsx` - Luồng tạo ảnh AI.
- `src/components/editor/canvas.tsx`, `layer-panel.tsx`, `toolbar.tsx`, `guideline-panel.tsx` - Trình chỉnh sửa banner (react-konva).
- `src/components/library/asset-grid.tsx`, `asset-filters.tsx`, `asset-detail.tsx` - Thư viện và chi tiết tài sản.
- `src/app/dashboard/page.tsx`, `src/app/create/image/page.tsx`, `src/app/create/banner/[assetId]/page.tsx`, `src/app/library/page.tsx`, `src/app/library/[id]/page.tsx`, `src/app/brands/page.tsx`, `src/app/brands/[id]/page.tsx`, `src/app/members/page.tsx` - Các route chính.

### Notes

- Chưa có test runner trong scope Phase 1 (PRD không yêu cầu); nếu bổ sung sau, dùng Vitest/Playwright và đặt file test cạnh file nguồn (`*.test.ts(x)`).
- Mọi migration tuân thủ quy ước: idempotent (`create table if not exists`, `add column if not exists`), bật RLS ngay khi tạo bảng, không có policy `using (true)`.
- Sau mỗi task cấp cao, chạy `tsc --noEmit`, `eslint`, `next build` trước khi đánh dấu hoàn thành.
- Không tự chạy SQL migration lên Supabase thật — chỉ tạo file, người dùng tự chạy thủ công (theo đúng thói quen đã thống nhất ở dự án Rymi).

## Tasks

- [x] 0.0 Khởi tạo repository và tạo feature branch
  - [x] 0.1 Khởi tạo git repo tại `ZLP AI Hub/` (hiện đang trống, chưa có `.git`), tạo `.gitignore` (node_modules, .env*, .next)
  - [x] 0.2 Tạo và checkout branch `feature/phase-1-foundation`

- [x] 1.0 Scaffold dự án, xác thực và quản lý thành viên (khung ứng dụng)
  - [x] 1.1 Khởi tạo Next.js (App Router, TypeScript) + Tailwind + shadcn/ui; cấu hình ESLint
  - [x] 1.2 Thiết lập `src/lib/supabase/{client,server,admin,middleware}.ts` theo ranh giới RLS-scoped vs service-role server-only
  - [x] 1.3 Migration 0001: `profiles`, `workspaces`, `memberships` (role enum admin/creator/viewer), RLS theo workspace
  - [x] 1.4 Trigger tự tạo `profiles` row khi có user mới trong `auth.users`
  - [x] 1.5 Màn hình đăng nhập/đăng ký (email/mật khẩu) + trạng thái loading/lỗi/phiên hết hạn
  - [x] 1.6 `src/proxy.ts`: refresh session, redirect theo xác thực (giống pattern đã dùng ở dự án Rymi)
  - [x] 1.7 Chọn/ghi nhớ workspace hiện tại khi user thuộc nhiều workspace
  - [x] 1.8 Màn hình "Thành viên" (Admin): mời, đổi vai trò, thu hồi quyền — Server Action tự kiểm tra quyền, không chỉ ẩn nút trên UI
  - [x] 1.9 App shell responsive: sidebar thu gọn (desktop), drawer (tablet), bottom nav (mobile) theo mục 9-10 PRD
  - [x] 1.10 Cập nhật `README.md`: quyết định stack, biến môi trường (`.env.example`), hướng dẫn chạy local

- [x] 2.0 Quản lý thương hiệu và brand guideline
  - [x] 2.1 Migration 0002: `brands`, `brand_guideline_versions` (logo urls, colors jsonb, fonts jsonb, safe-zone, người tạo/thời gian), RLS theo workspace
  - [x] 2.2 Migration 0003: `size_presets` (tên, kênh, width/height, format), `templates` (layout/layers schema jsonb)
  - [x] 2.3 Supabase Storage bucket cho brand assets (logo) + policy theo workspace, kiểm tra MIME/dung lượng khi upload
  - [x] 2.4 Form tạo/sửa thương hiệu: tên, mô tả, trạng thái, avatar
  - [x] 2.5 Upload & validate logo (SVG/PNG, biến thể sáng/tối)
  - [x] 2.6 Trình quản lý bảng màu (tên, hex, vai trò primary/secondary/background/text/accent) + font (danh sách cấp phép + fallback)
  - [x] 2.7 Cấu hình vùng an toàn & quy tắc logo (khoảng an toàn, nền phù hợp, kích thước tối thiểu)
  - [x] 2.8 Quản lý preset kích thước (CRUD theo kênh, không hard-code vào code)
  - [x] 2.9 Quản lý template banner cơ bản (tên + preset kích thước; bố cục layer thật sẽ nối vào Task 4.0)
  - [x] 2.10 Preview guideline tổng hợp + cảnh báo thiếu cấu hình trước khi cho phép dùng thương hiệu để tạo
  - [x] 2.11 Brand picker dùng chung cho luồng tạo ảnh/banner (component sẵn sàng, chưa được dùng tới khi Task 3.0 chưa xây)

- [x] 3.0 Sinh ảnh AI (generation job, provider adapter, upload)
  - [x] 3.1 Migration 0004: `generation_jobs` (type, prompt, params jsonb, provider/model, status enum queued/processing/succeeded/failed/cancelled, error, output jsonb), RLS theo owner/workspace — **đổi tên thành `0004_generation_jobs_assets.sql`**, gộp luôn `creative_assets` (xem ghi chú đầu file: Task 3.8 cần bảng này tồn tại ngay, không thể đợi đến migration 0005 ở Task 4.0 như kế hoạch gốc)
  - [x] 3.2 Interface adapter AI provider (`generateImages(params): Promise<GeneratedImage[]>`) — tách biệt khỏi luồng sản phẩm
  - [x] 3.3 Demo Provider: trả ảnh placeholder (SVG, không cần thư viện ảnh) có nhãn "Demo" rõ ràng khi chưa cấu hình API key thật
  - [x] 3.4 Khung Provider thật (chưa bật mặc định): `src/lib/generation/providers/index.ts` là điểm mở rộng, hiện luôn trả Demo Provider
  - [x] 3.5 Form tạo ảnh: thương hiệu, prompt, prompt loại trừ, preset kích thước, số biến thể, tóm tắt bảng màu thương hiệu
  - [x] 3.6 Server Action tạo job: nút submit tự khoá khi đang xử lý (chống double-click); không có idempotency key chống double-submit do mạng lỗi/retry (giới hạn đã biết, ghi trong README)
  - [x] 3.7 UI trạng thái job: queued/processing/succeeded/failed, poll 2 giây/lần; job id đẩy vào URL (`?job=`) nên refresh trang vẫn hiển thị đúng trạng thái/kết quả
  - [x] 3.8 Khi job thành công: lưu kết quả vào `creative_assets` (loại `image`)
  - [x] 3.9 Sau khi có ảnh: lưu thư viện, tải xuống, mở trong trình tạo banner (link sẵn `?asset=`, trang đích chưa xây tới Task 4.0); "tạo thêm biến thể" = submit lại form (chưa có nút riêng)
  - [x] 3.10 Upload ảnh làm nguồn thay thế AI (kiểm tra định dạng/dung lượng, lưu thẳng vào `creative_assets`)

- [x] 4.0 Trình chỉnh sửa banner (editor, kiểm tra guideline, xuất file)
  - [x] 4.1 Migration **`0005_design_documents_exports.sql`** (đổi tên — `creative_assets` đã có từ migration 0004, xem ghi chú Task 3.0): `design_documents`, `exports`, cột `creative_assets.current_design_document_id`
  - [x] 4.2 Khởi tạo design document từ ảnh nền (thư viện/upload, qua `/create/banner` bước 1) + preset/template đã chọn — logo được chèn tự động từ guideline hiện hành nếu có, khoá mặc định
  - [x] 4.3 Canvas editor (`react-konva`): layer background/image/logo/text/shape, click chọn, Transformer để resize/xoay
  - [x] 4.4 Thao tác layer: chọn, di chuyển (kéo), resize/xoay (Transformer), sắp xếp trước/sau (nút lên/xuống trong Layer panel)
  - [x] 4.5 Thuộc tính text: nội dung, font (danh sách cấp phép), cỡ, đậm, màu, căn chỉnh, line-height, letter-spacing
  - [x] 4.6 Lưới và vùng an toàn bật/tắt được qua toolbar; chưa có "đường căn" (smart alignment guide) khi kéo — xem giới hạn trong README
  - [x] 4.7 Undo/redo (lịch sử 50 bước); không autosave — cảnh báo `beforeunload` khi còn thay đổi chưa lưu
  - [x] 4.8 Thay ảnh nền giữ nguyên layer khác (`applyBackground`); "Nhân bản" tạo asset + design document mới từ bản hiện tại
  - [x] 4.9 Engine kiểm tra guideline (`src/lib/design/guideline-check.ts`) — hàm thuần, 7 check: kích thước, logo tồn tại, logo trong vùng an toàn, màu thuộc bảng màu, font thuộc cấu hình, chữ tràn khung, có ảnh nền
  - [x] 4.10 Hiển thị Đạt/Cần xem lại/Không đạt kèm lý do; **mặc định cứng** 2 check chặn xuất (sai kích thước, thiếu logo) theo đúng PRD, **chưa có UI để Admin tự cấu hình** — xem giới hạn trong README
  - [x] 4.11 `exports` nằm trong migration 0005 (gộp cùng design_documents, không tách 0006 riêng)
  - [x] 4.12 Xuất PNG/JPG bằng `Stage.toDataURL()` phía client ở độ phân giải gốc (không cần thư viện ảnh phía server); tên file `brand-asset-preset-vN.ext`
  - [x] 4.13 Design document có version, lưu riêng với file export (`exports` tham chiếu `design_document_id`, không ghi đè)

- [x] 5.0 Dashboard và thư viện tài sản (tìm kiếm/lọc, chi tiết, tải xuống/xóa)
  - [x] 5.1 Dashboard: nút Tạo mới (ảnh/banner) đã có từ trước; thêm **Tài sản gần đây** (6 mới nhất, dữ liệu thật) và **Tác vụ chưa hoàn tất** (job queued/processing của chính người dùng)
  - [x] 5.2 Thư viện: lưới thumbnail responsive (2 cột mobile → 4 cột desktop) — **chưa có chế độ danh sách (list view)**, chỉ có lưới; xem giới hạn trong README
  - [x] 5.3 Tìm kiếm theo tên/prompt/chiến dịch (gộp 1 ô, không phải lọc chiến dịch riêng) + lọc loại/thương hiệu/người tạo/trạng thái + sắp xếp mới/cũ nhất — **chưa có lọc theo khoảng ngày** riêng, xem README
  - [x] 5.4 Phân trang 20/trang qua URL (`?page=`), không tải toàn bộ thư viện (count + range trong 1 query)
  - [x] 5.5 Trang chi tiết: preview, loại/thương hiệu/kích thước/người tạo/ngày/trạng thái/chiến dịch, prompt (nếu có), lịch sử phiên bản (banner), thao tác theo quyền thật (owner hoặc admin mới thấy nút Xoá/Mở editor)
  - [x] 5.6 Tải xuống (link trực tiếp tới signed URL) & Xoá (AlertDialog xác nhận, RLS kiểm tra quyền thật, dọn luôn file trong Storage)
  - [x] 5.7 Trạng thái rỗng phân biệt "chưa có gì" vs "không khớp bộ lọc"; lỗi tải có nút Thử lại riêng biệt (không lẫn với rỗng thật)
  - [x] 5.8 Ghi nhận đủ 10 sự kiện PRD §14 (`src/lib/analytics/track.ts`) — chưa nối provider thứ ba thật, log có cấu trúc phía server là sink tạm thời, xem README
