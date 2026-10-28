# Aeonik Pro

Font thương hiệu chính thức của Creative Hub. Các file `.otf` trong thư mục
này đã được cấp phép và đang được nạp qua `next/font/local` trong
`src/app/layout.tsx` (không phải `@font-face` thủ công), tự xuất ra biến CSS
`--font-aeonik-pro` — biến này là bước đầu trong chuỗi fallback của token
`--font-sans` / `--font-heading` trong `src/app/globals.css`.

Các weight/style hiện có (khớp đúng tên file, đừng đổi tên khi thêm file
mới mà không cập nhật `layout.tsx`):

| File | Weight | Style |
|---|---|---|
| `AeonikPro-Light.otf` / `AeonikPro-LightItalic.otf` | 300 | normal / italic |
| `AeonikPro-Regular.otf` / `AeonikPro-RegularItalic.otf` | 400 | normal / italic |
| `AeonikPro-Medium.otf` / `AeonikPro-MediumItalic.otf` | 500 | normal / italic |
| `AeonikPro-Bold.otf` / `AeonikPro-BoldItalic.otf` | 700 | normal / italic |
| `AeonikPro-Black.otf` / `AeonikPro-BlackItalic.otf` | 900 | normal / italic |

Nếu cần thêm weight khác, thêm file vào đây rồi khai báo thêm một entry
trong mảng `src` của `localFont(...)` ở `src/app/layout.tsx`.
