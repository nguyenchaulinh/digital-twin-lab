# Digital Twin Lab

[English](README.md)

Dự án học tập nhỏ, dựng **digital twin của một khu đô thị**: 8 tòa chung cư thật quanh Vinhomes Smart City (Hà Nội), với điều kiện trong nhà được mô phỏng, thời tiết và chất lượng không khí ngoài trời lấy trực tiếp, cùng một bộ khuyến nghị thông gió hoặc bật điều hòa.

> **Dự án học tập độc lập. Không liên quan tới Vingroup hay Vinhomes và không dùng dữ liệu từ hệ thống của họ.** Hình dạng và tên tòa nhà lấy từ OpenStreetMap. Mọi thứ bên trong tòa nhà (nhiệt độ phòng, công suất và điện năng điều hòa) đều là **mô phỏng**.

## Chức năng

- **Chế độ khu đô thị:** hình khối 3D của các tòa tháp và khoảng 40 công trình xung quanh, đùn theo số tầng. Mỗi tòa tô màu theo nhiệt độ trung bình các phòng.
- **Chế độ tòa nhà:** bấm vào một tòa để xem các phòng có cảm biến, chọn phòng, bật/tắt điều hòa (lệnh được gửi ngược về simulator).
- **Dữ liệu ngoài trời trực tiếp:** nhiệt độ Hà Nội từ Open-Meteo, chất lượng không khí (AQI, PM2.5) từ AQICN. Nếu nguồn thiếu hoặc quá hạn, simulator quay về chu kỳ ngày giả lập và HUD ghi rõ.
- **Bộ khuyến nghị:** với từng phòng, khuyên *mở cửa sổ*, *bật điều hòa*, *giữ cửa sổ đóng* hoặc *không cần làm gì*, kèm lý do và công suất tối đa có thể tiết kiệm. Sức khỏe được ưu tiên (xem [chính sách](#chính-sách-khuyến-nghị)).
- **Giao diện tiếng Anh / tiếng Việt**, có nút chuyển EN/VI. Lựa chọn được nhớ trong trình duyệt.

## Kiến trúc

```
server/sim.mjs  ──snapshot mỗi 1 giây (WebSocket)──►  src/main.ts  ─► cảnh 3D + HUD + khuyến nghị
   ▲  mô hình nhiệt từng phòng, nguồn live                │
   └────────────── lệnh {setAc} ◄─────────────────────────┘
```

| Lớp | Nằm ở đâu |
|---|---|
| 1. Thu thập | `server/sim.mjs` (phòng giả lập), `server/feeds.mjs` (Open-Meteo, AQICN) |
| 2. Truyền | WebSocket `ws://127.0.0.1:8787` |
| 3. Mô hình hóa | footprint trong `data/township.json`, `src/township-view.ts`, `src/building-view.ts` |
| 4. Phân tích | `src/model.ts` (dự báo what-if), `src/advisor.ts` (chính sách) |
| 5. Tương tác | `src/main.ts`, `src/hud.ts`, lệnh điều hòa gửi ngược về simulator |

Mô hình riêng của twin (`src/model.ts`) cố tình hơi lệch so với vật lý của simulator: twin chỉ là xấp xỉ, và độ lệch đó chính là lý do phải hiệu chỉnh.

Tòa 39 tầng không được mô phỏng từng tầng. **12 tầng có cảm biến**, rải đều từ tầng đầu tới tầng cuối, và HUD hiển thị "12 / 39".

## Chạy nhanh

Cần Node.js. Đã thử trên **Node 24.22.1** và npm 11.

```bash
git clone https://github.com/nguyenchaulinh/digital-twin-lab.git
cd digital-twin-lab
npm install
cp .env.example .env     # tùy chọn, xem mục "Cấu hình"
```

Mở hai terminal:

```bash
npm run sim    # simulator tại ws://127.0.0.1:8787
npm run dev    # viewer tại http://localhost:5173
```

Mở http://localhost:5173. Bấm một tòa (hoặc một dòng trong danh sách), bấm một phòng, nhấn **A** để bật/tắt điều hòa, **Esc** để quay lại.

Hãy restart `npm run sim` mỗi khi sửa code simulator. Viewer từ chối snapshot của simulator cũ.

### Cấu hình

| Biến | Tác dụng |
|---|---|
| `AQICN_TOKEN` | Token miễn phí ở https://aqicn.org/data-platform/token/. Không có thì chất lượng không khí bị tắt và HUD hiện "không có" |
| `AQICN_STATION` | Mã trạm, tùy chọn. Mặc định `@8688` (Trường Quốc tế Liên Hợp Quốc Hà Nội). Trạm có thể ngừng hoạt động và trả `aqi: "-"` |

`npm run sim` tự nạp `.env` nếu có. `.env` được git bỏ qua; đừng commit token.

### Ghi đè AQI để demo

Mở `http://localhost:5173/?demoAqi=160` để đưa một AQI giả vào bộ khuyến nghị và xem nó ưu tiên sức khỏe hơn điện. HUD hiện một dòng riêng "AQI (ghi đè demo)" để không bị nhầm với dữ liệu thật.

## Chính sách khuyến nghị

Sức khỏe trước, tiết kiệm điện sau (`src/advisor.ts`):

1. Không có dữ liệu chất lượng không khí: không bao giờ khuyên mở cửa sổ.
2. AQI trên 100: giữ cửa sổ đóng; chỉ khuyên bật điều hòa nếu phòng vượt ngưỡng thoải mái và điều hòa đang tắt.
3. AQI từ 100 trở xuống, ngoài trời mát hơn phòng ít nhất 1 °C và không quá 26 °C: thông gió thay vì bật điều hòa.
4. Còn lại: chỉ bật điều hòa khi phòng vượt 26 °C.

Các ngưỡng (100, 26 °C, 1 °C) là **giả định có thể chỉnh, không phải tiêu chuẩn**. Điều hòa được giả định công suất 1 kW và chạy điều biến, nên "tiết kiệm tối đa X kW" là cận trên, không phải mức tiết kiệm đo được.

## Lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run sim` | Chạy simulator |
| `npm run dev` | Chạy Vite dev server |
| `npm run build` | Build production |
| `npm test` | Chạy toàn bộ test (`test:feeds`, `test:township`, `test:advisor`) |
| `npm run fetch:township` | Lấy lại footprint khu đô thị từ OpenStreetMap (ghi `data/township.json`) |
| `npx tsc -p .` | Kiểm tra kiểu |

## Cấu trúc thư mục

```
data/township.json     footprint tòa nhà (trích từ OSM)
scripts/               script lấy dữ liệu một lần
server/                simulator, nguồn live, bộ đọc khu đô thị (+ test)
src/                   viewer: cảnh 3D, HUD, khuyến nghị, i18n
test/                  test của bộ khuyến nghị
```

## Phiên bản

three 0.187.0, vite 8.3.5, typescript 7.0.2, ws 8.22.1 (`package-lock.json` đã commit).

## Nguồn dữ liệu và giấy phép

| Dữ liệu | Nguồn | Giấy phép / điều khoản |
|---|---|---|
| Nhiệt độ ngoài trời | [Open-Meteo](https://open-meteo.com/) | CC BY 4.0, bắt buộc ghi công. Bản miễn phí chỉ dành cho **phi thương mại** |
| Chất lượng không khí | [World Air Quality Index Project](https://aqicn.org/) | Cần token miễn phí. Hãy đọc điều khoản trước khi dùng ngoài mục đích học tập |
| Footprint, tên, số tầng tòa nhà | [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL 1.0, © OpenStreetMap contributors. `data/township.json` là bản trích và mang cùng giấy phép |

Số tầng thiếu trong OSM được giả định (nhà phố 2, nhà liền kề và trường học 3); các công trình đó chỉ làm nền, không được mô phỏng.

## Xử lý sự cố

- **Viewer báo "mất kết nối":** `npm run sim` chưa chạy, hoặc Vite không ở cổng 5173. Simulator chỉ nhận kết nối WebSocket từ `http://localhost:5173` và `http://127.0.0.1:5173`.
- **`UNABLE_TO_VERIFY_LEAF_SIGNATURE` trong log simulator:** bạn đang ở sau proxy kiểm tra TLS. `npm run sim` đã truyền sẵn `--use-system-ca` để dùng kho chứng chỉ của hệ thống. Đừng tắt xác thực TLS.
- **Cài đặt khi dùng registry nội bộ của công ty:** `npm install` có thể ghi URL registry nội bộ vào `package-lock.json`. Hãy kiểm tra trước khi commit lên repo public: `grep -c <host-registry-của-bạn> package-lock.json`.

## Hạn chế

- Dữ liệu trong nhà là mô phỏng; không có dataset mở về điều kiện trong nhà của các tòa nhà ở Việt Nam.
- Simulator chỉ lắng nghe `127.0.0.1` và không có xác thực. Đây là lab chạy cục bộ, không phải dịch vụ để triển khai.
- Thời gian chạy nhanh gấp 300 lần (1 giây = 5 phút mô phỏng) trong khi nhiệt độ ngoài trời là giá trị thật hiện tại, nên đồng hồ và thời tiết không nhất quán nếu chạy lâu.

## Lộ trình

Lớp vận hành (cảnh báo thành sự cố, giao việc), what-if điện mặt trời mái nhà và sạc xe điện, kịch bản ngập, bảng chỉ số ISO 37122, và giao diện hỏi twin bằng ngôn ngữ tự nhiên.
