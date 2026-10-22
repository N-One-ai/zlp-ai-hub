# PRD: Creative Hub

**Phiên bản:** 1.0
**Trạng thái:** Bản yêu cầu để giao Claude xây dựng
**Ngôn ngữ sản phẩm:** Tiếng Việt
**Tên sản phẩm tạm thời:** Creative Hub

## 1. Tóm tắt sản phẩm

Creative Hub là ứng dụng web responsive giúp đội ngũ tạo, quản lý và tải xuống hình ảnh marketing phù hợp với nhận diện thương hiệu. Người dùng chọn thương hiệu và mẫu/kích thước đầu ra, mô tả ý tưởng, tạo hình bằng AI, sau đó hoàn thiện banner với logo, nội dung và quy tắc thiết kế đã cấu hình. Tất cả sản phẩm được lưu vào dashboard để tìm kiếm, xem lại và tải xuống.

Sản phẩm triển khai theo hai giai đoạn:

- **Phase 1 — Ảnh và banner:** đăng nhập, quản lý thương hiệu và guideline, tạo ảnh AI, dàn trang banner theo kích thước có sẵn, quản lý thư viện và xuất file.
- **Phase 2 — Video:** tạo video từ prompt/ảnh, chọn định dạng và thời lượng, theo dõi tiến trình, quản lý và xuất video. Phase 1 cần có cấu trúc đủ rõ để bổ sung video sau này, nhưng không triển khai tính năng video.

## 2. Bối cảnh và cơ hội

Đội marketing thường phải tạo nhiều biến thể hình ảnh cho chiến dịch và nhiều kênh khác nhau. Việc kiểm tra màu sắc, font, logo, kích thước, vùng an toàn và phiên bản file bằng tay làm chậm quá trình, dẫn đến tài sản không nhất quán hoặc phải sửa nhiều vòng.

Creative Hub tập trung quy trình này trong một nơi: cung cấp lựa chọn đã gắn với guideline, biến đầu ra thành tài sản có thể quản lý, và giúp người dùng tạo nhanh mà vẫn kiểm soát nhận diện thương hiệu.

## 3. Mục tiêu và chỉ số thành công

### Mục tiêu

1. Người dùng mới có thể đăng nhập, chọn thương hiệu và tạo sản phẩm đầu tiên mà không cần hướng dẫn trực tiếp.
2. Người dùng có thể tạo ảnh AI và banner theo kích thước/kênh đã định nghĩa.
3. Logo, màu, font và quy tắc thương hiệu được áp dụng nhất quán trong quy trình tạo banner.
4. Người dùng có thể xem lại, lọc, mở, tải xuống và quản lý các sản phẩm đã tạo.
5. Giao diện hoạt động tốt trên desktop và mobile.

### Chỉ số cần theo dõi

- Tỷ lệ người dùng hoàn thành sản phẩm đầu tiên.
- Thời gian trung vị từ lúc bắt đầu đến khi tải sản phẩm.
- Số lượt tạo thành công và tỷ lệ lỗi theo loại tác vụ.
- Tỷ lệ sản phẩm được tải xuống hoặc tạo biến thể.
- Tỷ lệ banner đạt các kiểm tra guideline trước khi xuất.
- Tỷ lệ người dùng quay lại và sử dụng trong 7/30 ngày.

Không đặt mục tiêu số cụ thể trước khi có dữ liệu sử dụng thực tế; cần ghi nhận sự kiện để thiết lập baseline.

## 4. Người dùng và quyền

### Vai trò tối thiểu

- **Admin:** mời/quản lý người dùng; tạo và chỉnh sửa cấu hình thương hiệu, guideline, mẫu và preset kích thước; xem toàn bộ tài sản; quản lý cấu hình dịch vụ AI.
- **Creator:** tạo ảnh/banner, xem và quản lý tài sản trong phạm vi được cấp, tải xuống.
- **Viewer (có thể bật/tắt):** xem và tải xuống tài sản được chia sẻ; không tạo hoặc thay đổi cấu hình.

Phase 1 có thể bắt đầu với một workspace và một hoặc nhiều thương hiệu. Mỗi tài sản phải lưu chủ sở hữu, thương hiệu, thời điểm tạo và trạng thái. Hệ thống phải kiểm tra quyền ở phía server, không chỉ ẩn thao tác trên giao diện.

## 5. Phạm vi

### Phase 1 — Bắt buộc

- Đăng nhập và quản lý phiên.
- Dashboard và thư viện tài sản.
- Quản lý cấu hình thương hiệu và brand guideline.
- Tạo ảnh bằng AI qua một provider/model adapter có thể thay thế.
- Tạo banner từ ảnh đã tạo/tải lên hoặc ảnh trong thư viện.
- Preset kích thước theo kênh và tùy chọn kích thước tùy chỉnh.
- Trình chỉnh sửa banner cơ bản: ảnh nền, logo, tiêu đề/nội dung, màu, font, căn chỉnh, khoảng cách, vùng an toàn.
- Kiểm tra guideline trước khi xuất và hiển thị cảnh báo dễ hiểu.
- Tạo biến thể, lưu, tìm kiếm/lọc, tải xuống và xóa tài sản theo quyền.
- Responsive, ưu tiên desktop cho editor và mobile cho tạo nhanh, xem và tải tài sản.
- Trạng thái tác vụ, thông báo lỗi và thử lại khi phù hợp.

### Phase 2 — Thiết kế sau, không triển khai Phase 1

- Tạo video từ prompt, ảnh hoặc tài sản có sẵn.
- Thiết lập tỷ lệ khung hình, độ dài, chuyển động và preset thương hiệu.
- Theo dõi tiến trình tác vụ dài, xem preview, tạo phiên bản và xuất video.
- Thư viện, bộ lọc và trang chi tiết hỗ trợ loại tài sản video.

### Ngoài phạm vi Phase 1

- Mạng xã hội/cộng đồng công khai, feed công khai, like hoặc bình luận.
- Tạo mô hình AI riêng hoặc huấn luyện model.
- Lập lịch và tự đăng lên mạng xã hội.
- Quy trình duyệt nhiều cấp, trừ khi được xác nhận là cần trong giai đoạn đầu.
- Thanh toán/gói thuê bao, trừ khi được xác định là yêu cầu kinh doanh.

## 6. Nguyên tắc sản phẩm và guideline

1. **Brand-first:** trước khi tạo, người dùng chọn thương hiệu và hệ thống hiển thị guideline liên quan.
2. **Guideline là cấu hình có nguồn gốc:** Admin tải lên asset và cấu hình giá trị có cấu trúc; không suy đoán màu/font/logo từ ảnh tham khảo.
3. **AI tạo hình, editor kiểm soát bố cục:** không phụ thuộc vào việc model sinh chính xác chữ hoặc logo. Chữ và logo của banner được đặt bằng editor sau khi có ảnh nền.
4. **Cảnh báo minh bạch:** chỉ đánh dấu "đạt" khi kiểm tra được bằng quy tắc xác định; tiêu chí chủ quan phải ghi là gợi ý/cần xem lại.
5. **Không làm mất dữ liệu:** lưu phiên bản khi chỉnh sửa; báo rõ trước khi xóa hoặc thay thế nội dung.
6. **Tài sản riêng tư mặc định:** không công khai nội dung hoặc prompt nếu chưa có hành động chia sẻ rõ ràng.

## 7. Luồng người dùng chính

### 7.1 Đăng nhập và vào dashboard

1. Người dùng mở ứng dụng và đăng nhập.
2. Nếu được cấp nhiều thương hiệu, chọn workspace/thương hiệu; có thể ghi nhớ lựa chọn gần nhất.
3. Dashboard hiển thị nút **Tạo mới**, tài sản gần đây, trạng thái tác vụ và bộ lọc theo loại tài sản/thương hiệu.

### 7.2 Tạo ảnh AI

1. Chọn **Tạo ảnh** và thương hiệu.
2. Nhập prompt; có thể nhập prompt loại trừ, chọn phong cách, tỷ lệ/kích thước và số lượng biến thể nếu được hỗ trợ.
3. Giao diện tóm tắt preset và lưu ý guideline liên quan.
4. Gửi tác vụ; hiển thị trạng thái đang chờ/đang tạo/hoàn tất/thất bại.
5. Xem kết quả, tạo thêm biến thể, mở trong editor banner, lưu vào thư viện hoặc tải xuống.

### 7.3 Tạo banner

1. Chọn **Tạo banner**, thương hiệu và kênh/preset (ví dụ: Instagram post/story, Facebook cover, web hero). Kích thước preset do Admin cấu hình, không hard-code giới hạn vào sản phẩm.
2. Chọn ảnh nền đã có, tải ảnh lên hoặc tạo ảnh mới.
3. Chọn bố cục/mẫu có sẵn; editor nạp logo, màu và font từ thương hiệu.
4. Sửa nội dung, vị trí, cỡ chữ, màu và hình ảnh trong phạm vi cho phép.
5. Xem preview và kiểm tra guideline: đúng kích thước, logo hiện diện/không bị che, nằm trong vùng an toàn, màu/font thuộc danh sách cấu hình, chữ không tràn khung.
6. Lưu bản nháp hoặc xuất PNG/JPG (PDF nếu bật). Giữ bản thiết kế có thể chỉnh sửa cùng file đã xuất.

### 7.4 Quản lý tài sản

1. Mở **Thư viện** từ thanh điều hướng.
2. Tìm kiếm theo tên/nội dung; lọc theo loại (ảnh/banner/video trong tương lai), thương hiệu, chiến dịch, người tạo, ngày và trạng thái.
3. Mở trang chi tiết để xem preview, prompt và thông tin tạo, phiên bản, lịch sử sửa cơ bản, tải xuống hoặc tạo biến thể.
4. Xóa theo quyền; yêu cầu xác nhận và phản ánh trạng thái đã xóa.

## 8. Yêu cầu chức năng

### 8.1 Xác thực và thành viên

- Đăng nhập/đăng xuất; xử lý hết hạn phiên và đường dẫn quay lại sau đăng nhập.
- Phase 1 ưu tiên email/mật khẩu hoặc đăng nhập Google nếu OAuth khả dụng. Chọn một phương thức cho MVP và ghi trong README.
- Admin có thể mời thành viên, đổi vai trò, thu hồi quyền truy cập.
- Có trạng thái loading, lỗi đăng nhập, tài khoản không có quyền và phiên hết hạn.

### 8.2 Thương hiệu và guideline

Mỗi thương hiệu có thể cấu hình:

- Tên, mô tả, trạng thái, ảnh đại diện.
- Logo chính/phụ, biến thể sáng/tối; hỗ trợ SVG/PNG và kiểm tra file.
- Bảng màu có tên, mã HEX và vai trò (primary/secondary/background/text/accent).
- Font heading/body, font file hoặc lựa chọn font được cấp phép; fallback rõ ràng.
- Quy tắc logo: phiên bản ưu tiên, kích thước tối thiểu nếu biết, khoảng an toàn, nền phù hợp.
- Vùng an toàn và quy tắc bố cục; hướng dẫn bằng văn bản.
- Danh sách preset kích thước: tên preset, kênh, pixel rộng/cao, format xuất.
- Mẫu banner: bố cục, trường chữ, vị trí logo, vùng ảnh và thuộc tính chỉnh sửa được.
- Metadata chiến dịch/tags tùy chọn.

Admin cần preview guideline và kiểm tra cấu hình thiếu asset trước khi cho phép sử dụng thương hiệu. Lưu dấu thời gian và người chỉnh sửa. Tài sản cũ giữ snapshot phiên bản guideline đã áp dụng khi tạo.

### 8.3 Sinh ảnh

- Form gồm thương hiệu, prompt, prompt loại trừ (nếu model hỗ trợ), tỷ lệ, chất lượng/model, số ảnh và seed (nếu provider hỗ trợ).
- Mặc định dùng model/provider cấu hình phía server; không gửi API key về browser.
- Tác vụ dài chạy nền hoặc qua cơ chế job tương đương; client có thể rời trang rồi quay lại xem trạng thái.
- Có retry an toàn với lỗi tạm thời; không tạo trùng tác vụ do double-click.
- Lưu prompt, tham số, provider/model, thời gian, trạng thái, lỗi đã chuẩn hóa và đầu ra.
- Hỗ trợ ảnh tải lên với kiểm tra định dạng, dung lượng và trạng thái xử lý.
- Giao diện cho biết ảnh AI có thể cần kiểm tra thủ công về chi tiết và nội dung.

### 8.4 Editor banner

- Canvas theo đúng tỷ lệ đầu ra, zoom vừa màn hình và preview ở kích thước thực tế.
- Thêm/sửa/xóa các lớp ảnh, chữ, logo và hình khối đơn giản.
- Chọn lớp, di chuyển, đổi kích thước, căn lề, sắp xếp trước/sau; khóa logo nếu mẫu yêu cầu.
- Chỉnh nội dung, font, cỡ, độ đậm, màu, căn chỉnh, line-height và khoảng cách chữ ở mức MVP.
- Có lưới, đường căn và vùng an toàn có thể bật/tắt.
- Undo/redo cơ bản; autosave hoặc nhắc lưu khi rời trang.
- Thay ảnh nền mà không làm mất nội dung banner; tạo bản sao/biến thể.
- Nhúng font vào render nếu giấy phép và kỹ thuật cho phép; nếu không, hiển thị font fallback trước khi xuất.
- Lưu tài liệu thiết kế theo định dạng nội bộ có version để mở lại, không chỉ lưu ảnh raster.

### 8.5 Kiểm tra guideline và xuất

- Kiểm tra máy đọc được: đúng kích thước, lớp logo tồn tại, logo nằm trong canvas/vùng an toàn, font/màu nằm trong cấu hình, chữ vượt khung, ảnh thiếu.
- Kết quả hiển thị theo **Đạt**, **Cần xem lại** hoặc **Không đạt**, kèm lý do và cách sửa.
- Admin cấu hình lỗi nào chặn xuất; mặc định sai kích thước hoặc thiếu logo theo mẫu bắt buộc chặn xuất, cảnh báo khác cho phép tiếp tục.
- Xuất tối thiểu PNG và JPG đúng kích thước; tùy chọn nền trong suốt khi định dạng hỗ trợ. PDF là tùy chọn MVP.
- Tên file mặc định dễ nhận biết: thương hiệu, chiến dịch/tên tài sản, preset và phiên bản.
- Lưu file xuất và metadata gắn với bản thiết kế nguồn.

### 8.6 Dashboard và thư viện

- Dashboard cung cấp lối tắt tạo ảnh/banner, tài sản gần đây và tác vụ chưa hoàn tất.
- Thư viện có dạng lưới thumbnail và danh sách tùy chọn; mobile dùng lưới một hoặc hai cột tùy bề rộng.
- Tìm kiếm theo tên và prompt; lọc, sắp xếp theo ngày mới nhất/cũ nhất.
- Trang chi tiết có preview, loại tài sản, thương hiệu, kích thước, người tạo, ngày tạo, trạng thái, prompt/metadata, phiên bản và thao tác được phép.
- Hỗ trợ phân trang hoặc tải thêm để tránh tải toàn bộ thư viện một lần.
- Trạng thái rỗng hướng dẫn hành động tiếp theo; lỗi tải có nút thử lại.

## 9. Yêu cầu giao diện và responsive

Ảnh Leonardo.Ai đính kèm chỉ dùng làm tham khảo về thanh điều hướng, nhóm công cụ sáng tạo, khu vực nội dung lớn và thư viện tài sản dạng lưới. Không sao chép logo, tên, nội dung, màu nhận diện hoặc thiết kế độc quyền của Leonardo.Ai.

- **Desktop:** sidebar có thể thu gọn; dashboard và thư viện tận dụng không gian rộng; editor banner dùng canvas trung tâm, thanh công cụ/lớp bên cạnh.
- **Tablet:** sidebar chuyển thành drawer; editor giữ canvas dễ thao tác và bảng công cụ gọn.
- **Mobile:** điều hướng chính gọn (bottom navigation hoặc menu); form tạo xếp một cột; theo dõi tác vụ AI; preview và thư viện dùng toàn màn hình; editor cung cấp thao tác cơ bản và nút xuất dễ chạm.
- Mục tiêu vùng chạm tối thiểu khoảng 44×44 CSS px; không yêu cầu kéo chính xác để hoàn thành tác vụ chính.
- Kiểm tra trên viewport 360px, 768px và 1280px trở lên; không tràn ngang trong các luồng chính.
- Hỗ trợ keyboard focus, nhãn cho input, tương phản văn bản, thông báo trạng thái có thể đọc bởi screen reader.

## 10. Điều hướng đề xuất

- Dashboard
- Tạo mới: Tạo ảnh, Tạo banner
- Thư viện
- Thương hiệu (Admin)
- Thành viên (Admin)
- Cài đặt

Không cần feed cộng đồng công khai trong Phase 1. Có thể có bộ sưu tập dùng chung nội bộ nếu quyền truy cập được xác định.

## 11. Mô hình dữ liệu mức khái niệm

- **User:** id, tên, email, trạng thái.
- **Workspace:** id, tên, cấu hình và quyền.
- **Membership:** user, workspace, vai trò, trạng thái lời mời.
- **Brand:** workspace, tên, trạng thái, guideline version hiện hành.
- **BrandGuidelineVersion:** logo/assets, màu, font, vùng an toàn, preset, người tạo, thời gian.
- **Template:** brand, tên, kích thước, layers/schema, trạng thái.
- **CreativeAsset:** loại, tên, brand, owner, campaign/tags, preview, kích thước, trạng thái, ngày tạo.
- **GenerationJob:** loại job, prompt, tham số, provider/model, trạng thái tiến trình, lỗi, đầu ra.
- **DesignDocument:** cấu trúc editor, asset nguồn, snapshot guideline, lịch sử phiên bản.
- **Export:** định dạng, kích thước, đường dẫn lưu trữ, ngày tạo.

Thiết kế schema để `CreativeAsset` hỗ trợ loại `image`, `banner` và sau này `video`; không cần xây dựng pipeline video ở Phase 1.

## 12. Yêu cầu phi chức năng

- **Bảo mật:** kiểm tra quyền truy cập từng workspace/tài sản; bảo vệ secrets phía server; giới hạn loại/kích thước file; xác thực MIME; hạn chế request; log hành động quản trị quan trọng.
- **Riêng tư:** tài sản và prompt riêng tư theo workspace; không dùng nội dung người dùng để huấn luyện model nếu chưa có cơ sở và thông báo phù hợp.
- **Độ tin cậy:** trạng thái job bền vững qua refresh; timeout, retry và lỗi provider được xử lý; tránh mất bản thiết kế chưa lưu.
- **Hiệu năng:** ưu tiên thumbnail, tải ảnh gốc theo yêu cầu; editor phản hồi tốt trên thiết bị phổ biến. Mục tiêu khởi điểm: nội dung giao diện chính tải trong 3 giây trên kết nối băng thông trung bình, không tính thời gian model sinh ảnh.
- **Khả năng tiếp cận:** điều hướng bàn phím, focus rõ, label và thông báo lỗi có ngữ nghĩa, độ tương phản đủ.
- **Khả năng quan sát:** log job ID, thời gian, provider và lỗi đã loại bỏ thông tin nhạy cảm; có dashboard lỗi/tỷ lệ thành công cơ bản.
- **Lưu trữ:** file nguồn, preview, file xuất và cấu hình có quy tắc quyền truy cập; tránh public URL không kiểm soát.
- **Khả năng mở rộng:** tách adapter AI generation, storage và rendering để thay provider mà không viết lại luồng sản phẩm.

## 13. Trạng thái và thông báo

Job tạo cần có trạng thái: `queued`, `processing`, `succeeded`, `failed`, `cancelled` (hủy có thể là tùy chọn). Hiển thị thời gian tạo, tiến trình nếu provider cung cấp, và hành động tiếp theo. Không giả lập phần trăm tiến trình nếu không có dữ liệu thật. Khi lỗi, hiển thị thông báo thân thiện và mã tham chiếu để hỗ trợ; không lộ stack trace hoặc khóa API.

## 14. Sự kiện phân tích

Ghi nhận tối thiểu: `login_success`, `brand_selected`, `generation_started`, `generation_succeeded`, `generation_failed`, `banner_editor_opened`, `guideline_check_completed`, `export_succeeded`, `asset_downloaded`, `asset_deleted`.

Mỗi sự kiện cần có user/workspace ID dạng nội bộ, loại tài sản, thương hiệu và timestamp phù hợp; không gửi prompt hoặc nội dung nhạy cảm vào analytics bên thứ ba theo mặc định.

## 15. Tiêu chí nghiệm thu MVP

1. Người dùng được xác thực và chỉ truy cập dữ liệu workspace được cấp.
2. Admin tạo thương hiệu, tải logo lên và cấu hình ít nhất màu, font, preset kích thước.
3. Creator có thể tạo ảnh AI; trạng thái job và kết quả vẫn tồn tại sau khi tải lại trang.
4. Creator có thể tạo banner từ ảnh, đặt logo và chữ, chỉnh sửa bố cục và lưu bản có thể mở lại.
5. Kiểm tra kích thước, thiếu logo, vùng an toàn và chữ tràn được hiển thị có giải thích.
6. Có thể xuất PNG/JPG đúng preset và tải lại từ trang chi tiết tài sản.
7. Tài sản xuất hiện trong thư viện và lọc được theo loại/thương hiệu; quyền xóa được áp dụng.
8. Các luồng đăng nhập, tạo ảnh, tạo banner, thư viện và tải xuống dùng được ở viewport mobile và desktop.
9. Trường hợp provider lỗi hoặc quota hết được báo rõ; người dùng có thể thử lại khi phù hợp.
10. Không có API secret trong client bundle hoặc giao diện browser.

## 16. Rủi ro và hướng xử lý

- **AI không vẽ chữ/logo chính xác:** đặt chữ/logo bằng editor riêng sau khi sinh ảnh.
- **Khó kiểm chứng guideline tự động:** bắt đầu với quy tắc xác định, hiển thị cảnh báo chủ quan như gợi ý, cho Admin quyết định điều kiện chặn xuất.
- **Font và quyền sử dụng:** chỉ cho tải font được phép; ghi rõ fallback và kiểm tra render.
- **Chi phí/tốc độ model thay đổi:** adapter provider, cấu hình model phía server, giới hạn/quota theo workspace và theo dõi chi phí.
- **Ảnh nặng trên mobile:** tạo preview/thumbnail, tải theo nhu cầu và giới hạn upload cấu hình được.
- **Scope editor quá lớn:** MVP giới hạn layer ảnh/chữ/logo/hình khối và thao tác căn chỉnh; chưa cần editor vector chuyên nghiệp.

## 17. Giả định cần chốt khi build

Claude cần dùng các mặc định sau nếu chưa có thông tin bổ sung, và ghi những điểm này thành cấu hình dễ thay đổi:

- Một ứng dụng web responsive, một workspace ban đầu, hỗ trợ nhiều thương hiệu.
- Chưa có brand guideline cụ thể được cung cấp; xây dựng màn hình cấu hình trước, dùng dữ liệu demo có nhãn rõ ràng khi phát triển.
- Chưa chỉ định nhà cung cấp AI, đăng nhập, cloud/storage hoặc framework; chọn phương án đơn giản, an toàn, dễ thay thế và giải thích trong README.
- Dữ liệu và tài sản riêng tư; không làm feed công khai.
- Kích thước preset do Admin quản lý; có thể thêm preset mặc định minh họa nhưng cần cho phép chỉnh/xóa.
- Tạo video để Phase 2; Phase 1 chỉ cần schema/types và điều hướng có thể mở rộng, không hiển thị tính năng video giả hoạt động.

## 18. Hướng dẫn giao cho Claude

Hãy xây dựng Phase 1 theo PRD này. Trước khi bắt đầu, kiểm tra cấu trúc repository hiện tại và giữ nguyên lựa chọn công nghệ đã có. Nếu repository trống, chọn stack hiện đại phù hợp cho web app responsive và ghi quyết định vào README. Tạo giao diện chạy được với dữ liệu demo khi chưa có credentials, nhưng phân biệt rõ demo với tích hợp thật. Không tuyên bố sinh ảnh thật nếu provider chưa được cấu hình. Triển khai theo lát cắt có thể chạy được: xác thực/khung ứng dụng, thương hiệu, tạo ảnh/job, editor banner, thư viện/xuất. Sau mỗi lát cắt, cập nhật hướng dẫn chạy và các biến môi trường cần thiết. Ưu tiên trải nghiệm hoàn chỉnh, nhất quán trên desktop/mobile; không sao chép nhận diện hoặc màn hình của Leonardo.Ai.
