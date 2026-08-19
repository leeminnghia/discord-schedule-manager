# 📅 DISCORD BOOKING & SCHEDULE MANAGER

Hệ thống quản lý lịch đặt hẹn, điều phối thời gian làm việc cá nhân, tự động nhắc nhở và quản trị khách hàng chuyên nghiệp chạy 100% trên nền tảng **Discord** với **Node.js, TypeScript, Discord.js v14, Prisma ORM và PostgreSQL/SQLite**.

---

## 🌟 TÍNH NĂNG NỔI BẬT

### 1. 🛡️ Quản Lý Đặt Lịch & Chống Trùng Tuyệt Đối
- **Chống trùng lịch thông minh (Overlap Engine)**: Từ chối mọi request đè lên lịch đã có hoặc thời gian đã khóa theo công thức:
  $$\text{newStart} < \text{existingEnd} \quad \text{AND} \quad \text{newEnd} > \text{existingStart}$$
- **Buffer Time**: Cấu hình thời gian đệm giữa 2 lượt khách (ví dụ 10 phút).
- **Working Hours**: Kiểm soát chặt chẽ khung giờ làm việc từng ngày trong tuần.
- **Khóa thời gian cá nhân (`/block` & `/unblock`)**: Chặn nhận lịch khi bận việc riêng hoặc nghỉ ngơi.
- **Xử lý thời lượng linh hoạt**: Hỗ trợ nhập tự nhiên: `30m`, `1h`, `1h30m`, `2.5h`, `180m`.
- **Dời lịch (`/reschedule`), Gia hạn (`/extend`), Rút ngắn (`/shorten`), Hủy (`/cancel`), Hoàn thành (`/complete`)**.

### 2. 📊 Bảng Điều Khiển Live & Persistent Embeds
- Duy trì các message nhúng cố định trong các channel chuyên dụng, tự động cập nhật khi dữ liệu thay đổi:
  - `📊・tong-quan`: Lịch đang làm, lịch tiếp theo, thời gian đếm ngược ("Còn 58 phút"), tổng kết ngày, giờ trống, lịch sau đó.
  - `📅・lich-hom-nay`: Timeline biểu đồ trực quan xếp theo thứ tự thời gian.
  - `🗓️・lich-tuan`: Tổng quan 7 ngày kèm nút điều hướng `◀ Tuần trước`, `Hôm nay`, `Tuần sau ▶`.
  - `🟢・gio-con-trong`: Danh sách các slot trống sẵn sàng nhận khách.
  - `🤖・bot-command`: Control Panel với các nút tương tác nhanh (`➕ Đặt lịch`, `📅 Hôm nay`, `🟢 Giờ trống`, `➡️ Lịch tiếp`...).

### 3. ⏰ Hệ Thống Nhắc Lịch Bền Vững (Persistent Reminders)
- **Sống sót sau khi Bot Restart**: Toàn bộ mốc nhắc nhở được tính toán và lưu trực tiếp trong Database với trạng thái (`PENDING`, `SENT`, `MISSED`, `CANCELLED`).
- **Mốc nhắc nhở đa tầng**: Mặc định gửi vào `🔔・nhac-lich` lúc **30 phút trước**, **10 phút trước** và **Đúng giờ bắt đầu**.
- **Tương tác ngay trên thông báo**: Nút bấm `[▶️ Bắt đầu]`, `[⏰ Nhắc lại 5 phút]`, `[✅ Hoàn thành]`.
- **Phục hồi thông minh**: Khi bot bật lại sau sự cố mất điện/restart, tự động quét các reminder trễ trong ngưỡng cho phép (15 phút) để gửi bù, tránh spam reminder quá cũ.

### 4. 👤 Quản Trị Khách Hàng (CRM Mini)
- Tự động nhận diện hoặc lưu hồ sơ khách qua tên / Discord ID.
- Thống kê chi tiết: Tổng số lần đặt, số lịch hoàn thành, số lịch hủy, tổng số giờ làm việc.
- Lịch sử đặt hẹn (`/history`) kèm phân trang mượt mà.

### 5. 🔒 Bảo Mật & Phân Quyền
- Kiểm tra quyền Server-Side bằng `OWNER_USER_ID` và Administrator.
- Toàn bộ thay đổi quan trọng được ghi vào Audit Log Database và kênh `📋・bot-log`.

---

## 🏗️ CẤU TRÚC PROJECT

```text
discord-schedule-manager/
├── src/
│   ├── config/              # Cấu hình biến môi trường, constants, màu sắc
│   │   ├── constants.ts
│   │   └── env.ts
│   ├── database/            # Prisma Client wrapper & lifecycle
│   │   └── prisma.ts
│   ├── types/               # TypeScript interfaces & types
│   │   ├── booking.types.ts
│   │   ├── customer.types.ts
│   │   ├── schedule.types.ts
│   │   └── discord.types.ts
│   ├── utils/               # Tiện ích múi giờ, tính thời lượng, formatters, logger, errors
│   │   ├── timezone.ts      # Khóa múi giờ Asia/Ho_Chi_Minh GMT+7
│   │   ├── duration.ts      # Parser thời lượng 30m, 1h, 1.5h...
│   │   ├── formatters.ts    # Format timeline, mã BK-YYYYMMDD-XXX
│   │   ├── logger.ts        # Structured logger (Pino)
│   │   └── errors.ts        # Custom Error classes & Vietnamese handler
│   ├── services/            # Core business logic layer
│   │   ├── availability.service.ts
│   │   ├── booking.service.ts
│   │   ├── customer.service.ts
│   │   ├── schedule.service.ts
│   │   ├── blocked-time.service.ts
│   │   ├── reminder.service.ts
│   │   ├── dashboard.service.ts
│   │   ├── audit.service.ts
│   │   └── settings.service.ts
│   ├── scheduler/           # Background workers (Cron & interval polling)
│   │   ├── reminder.scheduler.ts
│   │   ├── auto-status.scheduler.ts
│   │   └── daily-summary.scheduler.ts
│   ├── server/              # HTTP Health Check Server (/health)
│   │   └── health.ts
│   ├── discord/             # Discord Bot Layer
│   │   ├── client.ts
│   │   ├── permissions.ts
│   │   ├── deploy-commands.ts
│   │   ├── components/      # Embeds, Action Rows, Modals, Pagination
│   │   ├── handlers/        # Command, Button, Modal, Autocomplete routers
│   │   └── commands/        # Toàn bộ Slash Commands theo nhóm
│   └── index.ts             # Application entrypoint & Graceful shutdown
├── prisma/
│   ├── schema.prisma        # Prisma Database schema
│   └── seed.ts              # Sample dev seed script
├── scripts/
│   ├── backup.ts            # Script backup toàn bộ DB ra file JSON
│   └── restore.ts           # Script khôi phục DB từ file JSON
├── tests/                   # Bộ test tự động Vitest
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

## 🗄️ DATABASE TABLES (PRISMA SCHEMA)

1. **`GuildSettings`**: Lưu cấu hình server, múi giờ, buffer time, working hours JSON, ID các category/channel và persistent message IDs.
2. **`Customer`**: Lưu hồ sơ khách hàng, discordUserId, số điện thoại, ghi chú, tổng số booking, hoàn thành, hủy, tổng số phút.
3. **`Booking`**: Lưu thông tin chi tiết từng lịch hẹn (`bookingCode`, `customerId`, `startAt`, `endAt`, `durationMinutes`, `status`, `note`, `createdBy`, `cancellationReason`).
4. **`BlockedTime`**: Lưu các khoảng thời gian cá nhân bị khóa (`startAt`, `endAt`, `reason`, `createdBy`).
5. **`Reminder`**: Lưu các mốc nhắc nhở (`bookingId`, `offsetMinutes`, `scheduledAt`, `sentAt`, `status`).
6. **`AuditLog`**: Lưu nhật ký kiểm toán mọi hành động tạo, dời, hủy, hoàn thành lịch.

---

## 🤖 DANH SÁCH SLASH COMMANDS

| Lệnh | Nhóm | Mô tả |
| :--- | :--- | :--- |
| `/setup` | Admin | Tự động tạo đầy đủ Category, Kênh và Bảng điều khiển |
| `/book` | Booking | Đặt lịch hẹn mới cho khách (tự động tính giờ, chống trùng) |
| `/booking` | Booking | Xem chi tiết 1 booking kèm các nút bấm thao tác nhanh |
| `/reschedule` | Booking | Dời lịch hẹn sang ngày hoặc giờ mới |
| `/extend` | Booking | Gia hạn thêm thời gian cho lịch hẹn |
| `/shorten` | Booking | Rút ngắn thời gian lịch hẹn |
| `/cancel` | Booking | Hủy lịch hẹn (giải phóng slot nhưng giữ lịch sử) |
| `/complete` | Booking | Đánh dấu hoàn thành lịch hẹn |
| `/upcoming` | Booking | Xem danh sách 5-10 lịch sắp tới |
| `/next` | Booking | Xem ngay lịch đang diễn ra hoặc lịch tiếp theo gần nhất |
| `/search` | Booking | Tìm kiếm lịch theo khách, ngày, trạng thái (phân trang) |
| `/today` | Schedule | Xem timeline làm việc chi tiết của ngày hôm nay |
| `/schedule` | Schedule | Xem timeline chi tiết của ngày bất kỳ |
| `/week` | Schedule | Xem tổng quan lịch trong tuần (kèm nút tuần trước/sau) |
| `/free` | Schedule | Xem danh sách các khoảng thời gian còn trống |
| `/findfree` | Schedule | Tìm các slot trống liên tục $\ge$ X giờ trong N ngày |
| `/available` | Schedule | Tạo văn bản lịch trống siêu ngắn gọn để copy gửi khách |
| `/stats` | Schedule | Xem thống kê hiệu suất làm việc (today, week, month) |
| `/customer` | Customer | Xem hồ sơ và thống kê chi tiết của một khách hàng |
| `/customers` | Customer | Xem danh sách toàn bộ khách hàng (phân trang) |
| `/history` | Customer | Xem toàn bộ lịch sử các lần đặt của một khách |
| `/block` | Admin | Khóa thời gian nghỉ ngơi hoặc việc riêng |
| `/unblock` | Admin | Mở khóa lại khoảng thời gian đã block |
| `/settings` | Admin | Cài đặt buffer time, giờ làm việc, nhắc nhở, timezone |
| `/help` | General | Xem bảng hướng dẫn sử dụng toàn bộ chức năng |

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY

### 1. Tạo Discord Application & Bot
1. Truy cập [Discord Developer Portal](https://discord.com/developers/applications).
2. Nhấn **New Application**, đặt tên cho Bot.
3. Vào mục **Bot**:
   - Nhấn **Reset Token** để lấy `DISCORD_TOKEN`.
   - Bật **Server Members Intent** (nếu cần quản lý thành viên).
4. Vào mục **OAuth2 -> URL Generator**:
   - Chọn scope: `bot`, `applications.commands`.
   - Chọn Bot Permissions:
     - `View Channels`
     - `Send Messages`
     - `Embed Links`
     - `Read Message History`
     - `Manage Channels` *(cần thiết để lệnh `/setup` tự tạo kênh)*
     - `Manage Messages`
   - Copy URL tạo ra và mở trên trình duyệt để mời Bot vào Server của bạn.
5. Bật **Developer Mode** trên Discord (User Settings -> Advanced -> Developer Mode).
   - Chuột phải vào tên bạn trên Discord -> **Copy User ID** để lấy `OWNER_USER_ID`.
   - Chuột phải vào Icon Server -> **Copy Server ID** để lấy `DISCORD_GUILD_ID`.
   - Vào Developer Portal -> General Information để lấy `DISCORD_CLIENT_ID`.

---

### 2. Cấu hình File `.env`

Tạo file `.env` từ `.env.example`:

```env
# Discord Bot Credentials
DISCORD_TOKEN=your_actual_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_discord_guild_id
OWNER_USER_ID=your_discord_user_id

# Database Configuration
# Dùng SQLite cho phát triển local:
DATABASE_URL="file:./dev.db"
# Hoặc dùng PostgreSQL cho Production:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/schedule_manager?schema=public"

# System Settings
DEFAULT_TIMEZONE=Asia/Ho_Chi_Minh
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

DEFAULT_BUFFER_MINUTES=10
MISSED_REMINDER_THRESHOLD_MINUTES=15
```

---

### 3. Chạy Môi Trường Local Development

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi tạo Prisma Database
npm run prisma:push

# 3. Chạy chế độ Development (tự động reload khi sửa code)
npm run dev
```

---

### 4. Khởi Tạo Server Lần Đầu Bằng Lệnh `/setup`

1. Mở Discord trong server của bạn.
2. Gõ lệnh:
   ```text
   /setup
   ```
3. Bot sẽ tự động tạo:
   - Danh mục **📌 DASHBOARD** (`📊・tong-quan`, `📅・lich-hom-nay`, `🗓️・lich-tuan`, `🟢・gio-con-trong`, `🔔・nhac-lich`).
   - Danh mục **📂 QUẢN LÝ** (`👤・khach-hang`, `✅・lich-hoan-thanh`, `❌・lich-da-huy`, `📝・ghi-chu`).
   - Danh mục **⚙️ SYSTEM** (`🤖・bot-command`, `📋・bot-log`, `⚙️・settings`).
   - Khởi tạo toàn bộ message Dashboard và Control Panel cố định.

---

### 5. Triển Khai Bằng Docker (Production với PostgreSQL)

Chỉ cần chạy 1 lệnh duy nhất:

```bash
docker-compose up -d --build
```

Container sẽ tự động khởi tạo cơ sở dữ liệu PostgreSQL kèm volume lưu trữ bền vững (`pgdata`) và khởi chạy Bot ở cổng 3000.

---

## 💾 SAO LƯU & KHÔI PHỤC DỮ LIỆU (BACKUP & RESTORE)

### Sao lưu dữ liệu ra file JSON:
```bash
npm run backup
```
File sao lưu sẽ được tạo trong thư mục `backups/backup-YYYY-MM-DDTHH-mm-ss.json`.

### Khôi phục dữ liệu:
```bash
npm run restore backups/backup-2026-08-19T13-00-00.json
```

---

## 🧪 KIỂM THỬ (TEST SUITE)

Hệ thống đi kèm bộ kiểm thử tự động toàn diện bằng Vitest:

```bash
npm test
```

Bao gồm:
- ✅ **Duration Parser**: Kiểm tra phân tích chuỗi thời lượng `30m`, `1h`, `1.5h`, `1h30m`, `180m`...
- ✅ **Timezone Converter**: Kiểm tra xử lý múi giờ `Asia/Ho_Chi_Minh`, chuyển đổi UTC, thứ trong tuần, mốc 24:00.
- ✅ **Availability & Overlap**: Kiểm tra thuật toán chống trùng lịch, buffer time (0 phút, 10 phút), khung giờ làm việc, khoảng thời gian đã block.
- ✅ **Booking Lifecycle**: Tạo booking, dời lịch, gia hạn, rút ngắn, hủy lịch, hoàn thành.
- ✅ **Reminder Persistence**: Kiểm tra lưu trữ DB, phục hồi reminder sau restart.

---

## 🔮 ĐỊNH HƯỚNG PHASE 2 (SẴN SÀNG MỞ RỘNG)

Kiến trúc Service-Repository-Handler hiện tại đã được tách lớp hoàn chỉnh, sẵn sàng tích hợp các tính năng mở rộng trong tương lai:
1. **Server dành riêng cho khách**: Khách tự xem lịch trống và gửi yêu cầu đặt lịch.
2. **Cổng thanh toán QR tự động**: Tích hợp VietQR, lưu ảnh bill và đăng vào kênh chứng thực uy tín.
3. **Đồng bộ Google Calendar**: 2-way sync giữa Discord và Google Calendar cá nhân.
4. **Hệ thống Multi-staff / Multi-services**: Quản lý nhiều nhân sự và nhiều dịch vụ khác nhau.
5. **Web Dashboard**: Giao diện Web quản trị đồng bộ thời gian thực qua REST API.
