# Digital Twin Lab

[English](README.md)

Dự án học tập nhỏ, dựng **digital twin của các khu đô thị trên khắp Việt Nam**: một bản đồ Việt Nam với mọi khu tìm thấy trong OpenStreetMap (các tòa nhà cao từ 10 tầng có tên; hai khu Vinhomes Smart City và Ocean Park nằm trong số đó), mỗi khu mở ra thành cảnh 3D với tối đa 8 tòa thật, điều kiện trong nhà được mô phỏng, thời tiết và chất lượng không khí ngoài trời lấy trực tiếp theo đúng vị trí, cùng một bộ khuyến nghị thông gió hoặc bật điều hòa.

> **Dự án học tập độc lập. Không liên quan tới Vingroup hay Vinhomes và không dùng dữ liệu từ hệ thống của họ.** Hình dạng và tên tòa nhà lấy từ OpenStreetMap. Mọi thứ bên trong tòa nhà (nhiệt độ phòng, công suất và điện năng điều hòa) đều là **mô phỏng**.

## Chức năng

- **Bản đồ Việt Nam:** ứng dụng mở đầu bằng một bản đồ (MapLibre GL, vector tile của OpenFreeMap) với mỗi khu là một điểm, gom cụm khi thu nhỏ. Bấm một điểm để xem tên và nút mở 3D, hoặc tìm trong danh sách bên phải theo tên, thành phố hoặc phường. Nút Bản đồ / Vệ tinh (góc dưới trái) chuyển sang ảnh vệ tinh có tên địa danh, để xem tòa nhà, đường và sông. Zoom từ mức 15 trở lên thì các tòa nhà của những khu đang trong khung nhìn được vẽ ngay trên bản đồ, dựng khối theo số tầng (tháp có mô phỏng màu hổ phách, còn lại màu xám); rê chuột vào tháp để xem tên, bấm để vào thẳng chi tiết tòa đó. Quay lại từ một khu thì bản đồ giữ nguyên như lúc rời đi.
- **Chế độ khu đô thị:** khuôn viên thật từ OpenStreetMap: 8 tòa tháp, tới 160 công trình xung quanh, đường và lối đi bộ, công viên, mặt nước, sân thể thao và bãi đỗ xe, các công trình được đùn theo số tầng. Nhấn **Esc** (hoặc nút phía trên danh sách) để về bản đồ. Mỗi tòa tô màu theo nhiệt độ trung bình các phòng; chú giải ở panel bên trái cho biết thang màu (20 đến 30 °C, đánh dấu ngưỡng cảnh báo 25 °C) và màu của tòa chưa có số đo. Danh sách tòa sắp xếp được theo từng cột (bấm lại tiêu đề để đảo chiều, bấm lần thứ ba để về thứ tự ban đầu) và lọc được chỉ còn các tòa có cảnh báo; khi chuột hoặc focus bàn phím đang ở trên các dòng thì thứ tự đứng yên, rời ra mới cập nhật. Di chuột vào một tòa (hoặc dòng của nó trong danh sách) sẽ làm sáng cả hai và hiện tên tòa trong tooltip.
- **Chế độ tòa nhà:** bấm vào một tòa để mở nó theo đúng hình dạng thật, với hai kiểu hiển thị (nút chuyển trong panel chi tiết). *Mặt tiền*: tòa nhà đặc có cửa sổ vẽ ở mỗi tầng, đứng trên ảnh vệ tinh của khu xung quanh (khoảng 430 m) và mái cũng phủ ảnh vệ tinh; phòng đang rê chuột hoặc đang chọn hiện xuyên qua tường. *Cảm biến*: lớp vỏ mờ với một đường kẻ ở mỗi tầng và một tấm màu cho từng phòng trên mỗi tầng có cảm biến. Mặt tiền là hình vẽ, không phải ảnh chụp: OSM không có ảnh mặt tiền (Xem phố mới cho thấy tòa nhà thật). Panel chi tiết hiện tên, liên kết OSM, số tầng, chiều cao ước tính, diện tích nền, các giá trị trung bình và bảng các tầng có cảm biến. Chọn phòng từ cảnh 3D hoặc từ bảng rồi bật/tắt điều hòa (lệnh được gửi ngược về simulator).
- **Xem phố:** ảnh đường phố từ Mapillary trong một panel, mở từ bản đồ (bấm *Xem phố* rồi bấm vào một con đường), từ popup của khu, hoặc từ tòa nhà đang mở. Hiện ảnh gần nhất trong bán kính 60 m, nếu không có thì 150 m. Cần `VITE_MAPILLARY_TOKEN`; không có thì các nút bị ẩn.
- **Camera:** từ zoom 10, các camera giao thông và camera đường phố có trên OpenStreetMap hiện thành chấm (tốc độ màu đỏ, đèn đỏ màu hồng tím, giao thông khác màu xanh, giám sát đường phố màu xám; nút *Camera* để ẩn). Popup cho biết loại camera, giới hạn tốc độ và hướng nếu có, liên kết OSM và nút Xem phố. **Chỉ có vị trí, không có hình ảnh trực tiếp:** chưa dịch vụ camera nào ở Việt Nam công bố API hay điều khoản dùng lại, nên popup chỉ dẫn tới dịch vụ chính thức của khu vực (cổng giao thông TP.HCM; Hà Nội là ứng dụng iHanoi). Nguồn trực tiếp đã được cho phép sẽ được thêm ở `src/camera-sources.ts`.
- **Dữ liệu ngoài trời trực tiếp:** nhiệt độ từ Open-Meteo và chất lượng không khí (AQI, PM2.5) từ trạm AQICN gần nhất, theo toạ độ của khu đang xem (HUD hiện tên trạm). Nếu nguồn thiếu hoặc quá hạn, simulator quay về chu kỳ ngày giả lập và HUD ghi rõ.
- **Bộ khuyến nghị:** với từng phòng, khuyên *mở cửa sổ*, *bật điều hòa*, *giữ cửa sổ đóng* hoặc *không cần làm gì*, kèm lý do và công suất tối đa có thể tiết kiệm. Sức khỏe được ưu tiên (xem [chính sách](#chính-sách-khuyến-nghị)).
- **Giao diện tiếng Anh / tiếng Việt**, có nút chuyển EN/VI. Lựa chọn được nhớ trong trình duyệt.

## Kiến trúc

```
server/sim.mjs  ──snapshot mỗi 1 giây (WebSocket)──►  src/main.ts  ─► bản đồ + cảnh 3D + HUD + khuyến nghị
   ▲  mô hình nhiệt từng phòng, nguồn live                │
   └──────── {watch} khu, lệnh {setAc} ◄──────────────────┘
```

| Lớp | Nằm ở đâu |
|---|---|
| 1. Thu thập | `server/sim.mjs` (phòng giả lập), `server/feeds.mjs` (Open-Meteo, AQICN) |
| 2. Truyền | WebSocket `ws://127.0.0.1:8787` |
| 3. Mô hình hóa | `data/catalog.json` (điểm trên bản đồ), bản trích OSM `data/townships/*.json` (tải khi cần), `src/map-view.ts`, `src/township-view.ts`, `src/building-view.ts` |
| 4. Phân tích | `src/model.ts` (dự báo what-if), `src/advisor.ts` (chính sách) |
| 5. Tương tác | `src/main.ts`, `src/hud.ts`, lệnh điều hòa gửi ngược về simulator |

Simulator chỉ mô phỏng và gửi dữ liệu của khu mà client đang **watch**; viewer gửi `{watch}` khi mở một khu và `null` khi về bản đồ. Client chỉ điều khiển được các phòng của khu mình đang watch.

Mô hình riêng của twin (`src/model.ts`) cố tình hơi lệch so với vật lý của simulator: twin chỉ là xấp xỉ, và độ lệch đó chính là lý do phải hiệu chỉnh.

Tòa 39 tầng không được mô phỏng từng tầng. **12 tầng có cảm biến**, rải đều từ tầng đầu tới tầng cuối, và HUD hiển thị "12 / 39".

## Chạy nhanh

Cần Node.js. Đã thử trên **Node 24.22.1** và npm 11.

```bash
git clone https://github.com/nguyenchaulinh/digital-twin-lab.git
cd digital-twin-lab
npm install
cp .env.example .env     # tùy chọn, xem mục "Cấu hình"
# Sau khi kéo tính năng bản đồ về, dùng `npm install` chứ không phải `npm ci`: maplibre-gl mới được thêm vào package.json
```

Mở hai terminal:

```bash
npm run sim    # simulator tại ws://127.0.0.1:8787
npm run dev    # viewer tại http://localhost:5173
```

Mở http://localhost:5173. Bấm một điểm khu đô thị rồi "Mở 3D", bấm một tòa (hoặc một dòng trong danh sách), bấm một phòng, nhấn **A** để bật/tắt điều hòa, **Esc** để lùi một cấp.

Hãy restart `npm run sim` mỗi khi sửa code simulator. Viewer từ chối snapshot của simulator cũ.

### Cấu hình

| Biến | Tác dụng |
|---|---|
| `AQICN_TOKEN` | Token miễn phí ở https://aqicn.org/data-platform/token/. Không có thì chất lượng không khí bị tắt và HUD hiện "không có" |
| `VITE_MAPILLARY_TOKEN` | Token **client** của Mapillary (`MLY\|…`), miễn phí ở https://www.mapillary.com/dashboard/developers. Vite đọc và đóng gói vào trang, đúng mục đích của token client; không bao giờ đặt secret vào biến `VITE_`. Không có thì tắt Xem phố. Đổi xong phải restart `npm run dev` |

`npm run sim` tự nạp `.env` nếu có. `.env` được git bỏ qua; đừng commit token.

### Ghi đè AQI để demo

Mở `http://localhost:5173/?demoAqi=160`, hoặc gõ một giá trị vào ô "AQI thử" trong panel của bộ khuyến nghị (số nguyên từ 0 đến 500), để đưa một AQI giả vào bộ khuyến nghị và xem nó ưu tiên sức khỏe hơn điện. HUD hiện một dòng riêng "AQI (ghi đè demo)" để không bị nhầm với dữ liệu thật. AQI thử không bao giờ được lưu.

## Chính sách khuyến nghị

Sức khỏe trước, tiết kiệm điện sau (`src/advisor.ts`):

1. Không có dữ liệu chất lượng không khí: không bao giờ khuyên mở cửa sổ.
2. AQI trên 100: giữ cửa sổ đóng; chỉ khuyên bật điều hòa nếu phòng vượt ngưỡng thoải mái và điều hòa đang tắt.
3. AQI từ 100 trở xuống, ngoài trời mát hơn phòng ít nhất 1 °C và không quá 26 °C: thông gió thay vì bật điều hòa.
4. Còn lại: chỉ bật điều hòa khi phòng vượt 26 °C.

Các ngưỡng (100, 26 °C, 1 °C) là **giả định có thể chỉnh, không phải tiêu chuẩn**, và panel bên trái cho chỉnh ngay khi đang mở một khu: mục *Ngưỡng của bộ khuyến nghị* có mỗi ngưỡng một thanh trượt: giới hạn AQI (0 đến 300, bước 5), ngưỡng thoải mái (22 đến 30 °C, bước 0,5) và độ mát hơn tối thiểu của ngoài trời (0 đến 5 °C, bước 0,5); HUD hiện số phòng rơi vào từng kết quả nên thấy tác động ngay. Panel đã chỉnh được đánh dấu "(đã đổi)" và nút *Đặt lại* trả về mặc định. Giá trị được lưu trong trình duyệt này (`localStorage`, đọc lại qua đúng các giới hạn của thanh trượt) và không gửi đi đâu. Dòng "Lý do" ghi giới hạn đang dùng. Bốn quy tắc ở trên viết cho giá trị mặc định. Điều hòa được giả định công suất 1 kW và chạy điều biến, nên "tiết kiệm tối đa X kW" là cận trên, không phải mức tiết kiệm đo được.

## Lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run sim` | Chạy simulator |
| `npm run dev` | Chạy Vite dev server |
| `npm run build` | Build production |
| `npm test` | Chạy toàn bộ test (`test:feeds`, `test:township`, `test:advisor`, `test:geometry`, `test:snapshot`, `test:mapbuildings`, `test:tiles`, `test:street`, `test:cameras`, `test:tablesort`, `test:urlstate`) |
| `npm run discover:townships` | Tìm các khu ứng viên trên toàn Việt Nam trong OpenStreetMap và ghi `scripts/townships.seed.json` (chỉ cần khi muốn làm mới danh sách) |
| `npm run fetch:township` | Trích mọi seed chưa có file (ghi `data/townships/*.json` và `data/catalog.json`). Chạy lại được, khoảng 45 giây mỗi khu trên server Overpass công cộng. `-- vn007` cho một khu, `-- --force` để ghi đè, `-- --rename` để sinh lại tên (không cần mạng) |
| `npm run fetch:cameras` | Trích camera giao thông và camera đường phố công cộng ở Việt Nam từ OSM vào `data/cameras.json` (một truy vấn Overpass). `-- --from <file>` để dùng lại kết quả Overpass đã lưu |
| `npx tsc -p .` | Kiểm tra kiểu |

## Cấu trúc thư mục

```
data/catalog.json      một bản ghi nhỏ cho mỗi khu, dùng cho bản đồ
data/townships/        bản trích OSM: tòa tháp, công trình, đường, cây xanh, mặt nước
scripts/               tìm và trích các khu đô thị (+ danh sách seed)
server/                simulator, nguồn live, bộ đọc khu đô thị (+ test)
src/                   viewer: cảnh 3D, HUD, khuyến nghị, i18n
test/                  test của bộ khuyến nghị
```

## Phiên bản

three 0.187.0, maplibre-gl ^5.21.0, vite 8.3.5, typescript 7.0.2, ws 8.22.1 (`package-lock.json` đã commit).

## Nguồn dữ liệu và giấy phép

| Dữ liệu | Nguồn | Giấy phép / điều khoản |
|---|---|---|
| Nhiệt độ ngoài trời | [Open-Meteo](https://open-meteo.com/) | CC BY 4.0, bắt buộc ghi công. Bản miễn phí chỉ dành cho **phi thương mại** |
| Chất lượng không khí | [World Air Quality Index Project](https://aqicn.org/) | Cần token miễn phí. Hãy đọc điều khoản trước khi dùng ngoài mục đích học tập |
| Bản đồ nền | vector tile của [OpenFreeMap](https://openfreemap.org/), © OpenMapTiles, dữ liệu © OpenStreetMap contributors | Không cần key. Trình duyệt tải tile từ `tiles.openfreemap.org` nên host đó thấy IP của người xem. Hãy đọc điều khoản trước khi dùng ngoài mục đích học tập |
| Vệ tinh | [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) và lớp địa danh của Esri | Không cần key, chỉ tải khi bấm nút Vệ tinh (`server.arcgisonline.com` thấy IP của người xem). Áp dụng điều khoản của Esri và phải giữ phần ghi nguồn trên màn hình; dùng ngoài lab này cần tài khoản ArcGIS hoặc nhà cung cấp khác (`src/tiles.ts` và `src/map-view.ts`). Chế độ tòa nhà cũng tải 9 tile ảnh quanh tòa đang mở |
| Ảnh đường phố | [Mapillary](https://www.mapillary.com/) qua `mapillary-js`, ảnh CC BY-SA | Token client miễn phí. Chỉ tải khi mở Xem phố; `graph.mapillary.com` và máy chủ ảnh của Mapillary thấy IP của người xem và vị trí được bấm. Độ phủ ở Việt Nam không đều |
| Camera | Vị trí từ OpenStreetMap (`man_made=surveillance`, `highway=speed_camera`, quan hệ enforcement), ODbL | 137 camera lúc trích (11/2026): 46 tốc độ, 2 đèn đỏ, 20 giao thông khác, 69 giám sát đường phố; bỏ camera tư nhân và trong nhà. Dữ liệu OSM thưa và không phải mạng camera chính thức. Dịch vụ chính thức (cổng TP.HCM, iHanoi) chỉ được dẫn link: chưa tìm thấy điều khoản dùng lại, và hình ảnh có thể có người và biển số xe (dữ liệu cá nhân), nên muốn dùng cần đơn vị vận hành cho phép và pháp chế xem xét |
| Footprint, tên, số tầng, đường, cây xanh, mặt nước | [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL 1.0, © OpenStreetMap contributors. `data/townships/*.json` là các bản trích và mang cùng giấy phép |

Số tầng thiếu trong OSM được giả định (nhà phố 2, nhà liền kề và trường học 3); các công trình đó chỉ làm nền, không được mô phỏng.

## Ghi chú thiết kế

- **Vì sao dùng OpenStreetMap thay vì Google Maps.** OSM cho footprint, tên, số tầng, đường, công viên và mặt nước mà không cần key và không tốn tiền. Photorealistic 3D Tiles của Google cần bật thanh toán và API key, thuộc nhóm Enterprise với hạn mức miễn phí nhỏ, bắt buộc ghi công và hiện logo Google, và chính sách cấm lưu đệm hoặc trích xuất dữ liệu để dùng ngoại tuyến. Việc Việt Nam có được phủ hay không chưa xác nhận được. Các điểm này lấy từ tìm kiếm web, không phải từ hợp đồng: hãy kiểm tra điều khoản hiện hành của Google trước khi dựa vào. Một key đưa xuống trình duyệt cũng bị lộ, nên mọi tích hợp Google phải đi qua một proxy nhỏ phía server.
- **Vì sao có các khu này.** `npm run discover:townships` truy vấn OSM mọi công trình từ 10 tầng trở lên ở Việt Nam (2.225 tòa tại thời điểm viết), giữ các tòa có tên thuộc loại nhà ở hoặc văn phòng, rồi gom những tòa cách nhau dưới 500 m. Nhóm từ 4 tòa trở lên thành một khu (139 khu: chủ yếu Hà Nội, rồi TP.HCM, Đà Nẵng và vài nơi khác, phản ánh nơi OSM được vẽ kỹ chứ không phải nơi có nhiều tòa nhà). Mỗi khu hiện 8 tòa gần tâm nhất; các tòa còn lại hiện màu xám làm nền. Tên khu được sinh tự động (thương hiệu chung, nếu không có thì tòa gần tâm nhất, rồi phường và thành phố) và có thể đặt tay trong file seed.
- **Bản đồ và cảnh 3D là hai cảnh riêng.** Bản đồ chỉ vẽ tòa nhà dạng khối đơn giản để tìm và bấm ngay tại chỗ; phòng, tầng và mặt tiền nằm trong cảnh three.js riêng của khu.
- **Server Overpass công cộng không dành cho việc tải hàng loạt tự động.** Việc trích xuất chỉ chạy một lần, chạy lại được và có giãn cách; các file JSON đã commit là kết quả, nên không ai cần chạy lại.
- **Chiều cao là giả định** 3 m mỗi tầng; số tầng lấy từ OSM (`building:levels`).
- **Hồ nước được vẽ trong OSM dưới dạng multipolygon relation thì chưa được vẽ**; chỉ trích xuất các way kín.

## Xử lý sự cố

- **Viewer báo "mất kết nối":** `npm run sim` chưa chạy, hoặc Vite không ở cổng 5173. Simulator chỉ nhận kết nối WebSocket từ `http://localhost:5173` và `http://127.0.0.1:5173`. Viewer tự thử lại mỗi 2 giây, nên restart simulator không cần tải lại trang.
- **Trang tự nhảy về bản đồ:** thanh địa chỉ lưu khu, tòa, phòng và kiểu hiển thị (`#t=…&b=…&r=…&m=…`), nên tải lại sẽ về đúng chỗ cũ và có thể chia sẻ link; địa chỉ trơn thì bắt đầu ở bản đồ. Giá trị lạ hoặc sai định dạng bị bỏ qua. Dev server không theo dõi `data/` (xem `vite.config.js`), vì `npm run fetch:township` ghi vào đó vài giây một lần và mỗi lần ghi sẽ reload trang. Sau khi fetch xong, restart `npm run dev` để nhận file mới.
- **`UNABLE_TO_VERIFY_LEAF_SIGNATURE` trong log simulator:** bạn đang ở sau proxy kiểm tra TLS. `npm run sim` đã truyền sẵn `--use-system-ca` để dùng kho chứng chỉ của hệ thống. Đừng tắt xác thực TLS.
- **Cài đặt khi dùng registry nội bộ của công ty:** `npm install` có thể ghi URL registry nội bộ vào `package-lock.json`. Hãy kiểm tra trước khi commit lên repo public: `grep -c <host-registry-của-bạn> package-lock.json`.

## Hạn chế

- Chỉ các khu mà OSM vẽ tốt mới có trên bản đồ: khu nào có ít tòa cao tầng có tên trong OSM sẽ không xuất hiện. Tên các khu sinh tự động có thể hơi vụng.
- Dữ liệu trong nhà là mô phỏng; không có dataset mở về điều kiện trong nhà của các tòa nhà ở Việt Nam.
- Simulator chỉ lắng nghe `127.0.0.1` và không có xác thực. Đây là lab chạy cục bộ, không phải dịch vụ để triển khai.
- Thời gian chạy nhanh gấp 300 lần (1 giây = 5 phút mô phỏng) trong khi nhiệt độ ngoài trời là giá trị thật hiện tại, và một khu chỉ chạy tiếp khi đang được xem, nên đồng hồ và thời tiết không nhất quán nếu chạy lâu.

## Lộ trình

Lớp vận hành (cảnh báo thành sự cố, giao việc), what-if điện mặt trời mái nhà và sạc xe điện, kịch bản ngập, bảng chỉ số ISO 37122, và giao diện hỏi twin bằng ngôn ngữ tự nhiên.
