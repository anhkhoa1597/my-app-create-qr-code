# QR Maker

Ứng dụng tạo QR Code bằng HTML, CSS và JavaScript thuần. Nhập nội dung, tùy chỉnh màu và kích thước, xem trước tự động rồi tải ảnh PNG.

Ứng dụng chạy ở phía client, không cần backend, database, tài khoản hay bước build. Giao diện sử dụng tiếng Anh.

## Tính năng

| Loại QR | Nội dung hỗ trợ |
| --- | --- |
| URL | Liên kết HTTP/HTTPS; tự thêm `https://` khi nhập tên miền như `google.com`. |
| Text | Văn bản tự do, hỗ trợ tiếng Việt và Unicode. |
| Wi-Fi | Tên mạng, mật khẩu và bảo mật WPA/WPA2, WEP hoặc None; escape ký tự đặc biệt. |
| Email | Địa chỉ nhận, tiêu đề và nội dung tùy chọn, mã hóa dưới dạng URI `mailto:`. |

- Preview tự động sau khi nhập, với debounce 180 ms.
- Chọn màu QR và màu nền bằng bảng màu hoặc mã hex sáu chữ số.
- Xuất PNG ở kích thước 128, 256, 512 hoặc 1024 px.
- Reset màu và kích thước về mặc định, giữ nguyên nội dung đang nhập.
- Báo lỗi ngay tại trường nhập; vô hiệu hóa tải xuống khi chưa có QR hợp lệ.
- Bố cục hai cột trên desktop, một cột ở màn hình rộng tối đa 800 px.
- Hỗ trợ bàn phím, nhãn cho các trường nhập và trạng thái focus rõ ràng.

## Chạy ứng dụng

Mở trực tiếp `index.html` bằng trình duyệt hiện đại, hoặc chạy một static server từ thư mục dự án nếu máy có Python 3:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Sau đó mở [http://127.0.0.1:5173](http://127.0.0.1:5173). Dừng server bằng `Ctrl+C`.

Không cần chạy `npm install`. Python chỉ dùng để phục vụ các tệp tĩnh khi phát triển, không phải backend của ứng dụng.

**Kết nối mạng:** thư viện QR được tải từ CDN jsDelivr. Cần mạng khi thư viện chưa có trong bộ nhớ đệm; ứng dụng chưa hỗ trợ offline độc lập. Sau khi thư viện đã tải, việc tạo QR không cần gọi API.

## Cách sử dụng

1. Chọn tab **URL**, **Text**, **Wi-Fi** hoặc **Email**.
2. Nhập nội dung tương ứng. QR tự xuất hiện khi dữ liệu hợp lệ.
3. Trong **Appearance**, chọn màu QR, màu nền và kích thước ảnh.
4. Nhấn **Download PNG** để tải ảnh, ví dụ `qr-url-256.png`.

Mặc định: QR đen `#000000`, nền trắng `#FFFFFF`, kích thước `256 × 256 px`. Nút **Reset** khôi phục ba thiết lập này.

Khi focus ở thanh chọn loại QR, dùng phím `←` / `→` để chuyển tab, `Home` / `End` để đến tab đầu/cuối. Dùng `Tab` để di chuyển giữa các điều khiển.

## Cấu trúc dự án

```text
MyQRCode/
├── index.html   # Cấu trúc giao diện và các form
├── style.css    # Kiểu hiển thị, màu sắc và responsive
├── app.js       # Validation, mã hóa nội dung, tạo QR và tải PNG
└── README.md
```

Thư mục `.agents/` chứa tài nguyên hỗ trợ phát triển, không cần để chạy ứng dụng.

## Công nghệ và luồng xử lý

- HTML5, CSS3 và Vanilla JavaScript.
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), phiên bản `1.4.4`, tải từ CDN với kiểm tra toàn vẹn SRI.
- Canvas API để vẽ QR và xuất PNG; `TextEncoder` để mã hóa UTF-8.

Luồng chính trong `app.js`:

```text
Nhập nội dung / thay đổi thiết lập
→ getFormData() + readSettings()
→ validateData()
→ buildQRContent()
→ generateQRCode()
→ cập nhật preview
```

`renderFormByType()` điều khiển chuyển tab, `resetSettings()` khôi phục thiết lập và `downloadQRCode()` tạo lại QR hiện tại trước khi tải xuống.

QR dùng mức sửa lỗi **M**, tự chọn phiên bản theo lượng dữ liệu. Mỗi ô QR được vẽ bằng số pixel nguyên và có vùng trống bao quanh tối thiểu bốn ô để giữ ảnh sắc nét.

## Quyền riêng tư và giới hạn

- Nội dung được xử lý trong trình duyệt, không gửi lên server. CDN chỉ cung cấp mã thư viện.
- Không có analytics, quảng cáo, cookie hay lưu lịch sử bằng local storage. Nội dung không được ứng dụng lưu lại sau khi tải lại trang.
- QR Wi-Fi chứa thông tin mạng, bao gồm mật khẩu nếu có; phần chú thích preview chỉ hiển thị tên mạng.
- Nội dung sau mã hóa được giới hạn ở 2.331 byte. Văn bản Unicode có thể chiếm nhiều byte cho mỗi ký tự; SSID tối đa 32 byte.
- Với nội dung dài, kích thước 128 px có thể không đủ. Chọn kích thước lớn hơn hoặc rút ngắn nội dung khi có thông báo.
- Ứng dụng cảnh báo khi màu khó quét nhưng vẫn cho phép xuất ảnh. Nên dùng QR tối trên nền sáng và thử quét trước khi in hoặc chia sẻ.
- Đây là QR tĩnh: muốn đổi nội dung phải tạo và tải ảnh mới. Hành vi mở email hoặc kết nối Wi-Fi phụ thuộc thiết bị và ứng dụng quét.

## Kiểm tra thủ công

Không có test runner hoặc dependency kiểm thử đi kèm. Sau khi chỉnh sửa, có thể kiểm tra nhanh:

1. Để trống nội dung: preview hiển thị trạng thái rỗng và nút tải bị vô hiệu hóa.
2. Nhập `google.com`: preview hiển thị nội dung chuẩn hóa `https://google.com/`.
3. Nhập URL/email không hợp lệ: lỗi xuất hiện dưới trường nhập và không tải được QR.
4. Thử văn bản tiếng Việt, Wi-Fi có dấu `;`, `:` hoặc `\`, và email có nhiều dòng.
5. Đổi màu, thử cả bốn kích thước, tải PNG và kiểm tra ảnh bằng ứng dụng quét QR.
6. Chuyển tab và dùng **Reset**: dữ liệu từng tab được giữ, thiết lập trở về mặc định.
7. Thử trên mobile và bằng bàn phím; kiểm tra không tràn ngang và console không có lỗi.
