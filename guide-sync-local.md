# Hướng dẫn đồng bộ dữ liệu Atlas → Local cho dev

## 1. Cài MongoDB Community Server

- Tải: https://www.mongodb.com/try/download/community
- Chọn phiên bản Windows, bản MSI
- Khi cài, tick chọn **Install MongoDB as a Service** (MongoDB chạy ngầm tự động)
- Cài xong là local database đã chạy ở `mongodb://127.0.0.1:27017`

## 2. Cài MongoDB Database Tools (mongodump, mongorestore)

- Tải: https://www.mongodb.com/try/download/database-tools
- Chọn Windows x86_64, file zip
- Giải nén file zip vừa tải

### Thêm folder bin vào PATH

Sau khi giải nén, bên trong có folder `bin/`. Làm theo các bước sau để thêm vào PATH:

1. **Win + R** → gõ `sysdm.cpl` → Enter
2. Tab **Advanced** → nút **Environment Variables...**
3. Ở **System variables** (ô dưới), chọn dòng `Path` → nút **Edit**
4. Cửa sổ **Edit environment variable** hiện ra → nút **New**
5. Dán đường dẫn đến folder `bin/`, ví dụ:
   ```
   C:\Users\<tên-máy>\Downloads\mongodb-database-tools-windows-x86_64-100.17.0\bin
   ```
6. Nút **OK** → đóng hết các cửa sổ

### Kiểm tra

Mở **CMD mới** (nhấn Win + R → gõ `cmd` → Enter), chạy:

```bash
mongodump --version
```

Nếu thấy hiện version là OK.

## 3. Cài MongoDB Compass (GUI xem dữ liệu)

- Tải: https://www.mongodb.com/try/download/compass
- Cài đặt mặc định

### Tạo 2 connection trong Compass

**Connection 1 — Local:**
- New Connection → `mongodb://127.0.0.1:27017` → Save as: **Local**
- Database `gym` sẽ tự động hiện sau khi có dữ liệu

**Connection 2 — Atlas:**
- New Connection → paste connection string Atlas lấy từ `.env` (mục 4.1) → Save as: **Atlas**
- Database `gymproAL` sẽ tự động hiện

=> Sau khi save, Compass có 2 connection, bấm vào cái nào thì xem dữ liệu của cái đó.

## 4. Đồng bộ dữ liệu từ Atlas xuống local

### 4.1 Lấy connection string Atlas

Vào file `gym-backend/.env`, tìm dòng:

```
MONGO_URI=mongodb+srv://...
```

Copy toàn bộ chuỗi sau dấu `=` (ví dụ: `mongodb+srv://daoxuanquyen333_db_user:Ffz9I2eUIlvydGkt@gym-cluster.fhqkyis.mongodb.net/gym`)

### 4.2 Chạy lệnh dump & restore

Mở CMD, chạy lần lượt:

```bash
cd D:\GymSystem
```

```bash
mongodump --uri="<chuỗi-kết-nối-atlas-vừa-copy>" --archive="atlas.archive"
```

Chờ nó chạy xong (có thể mất vài chục giây), rồi chạy tiếp:

```bash
mongorestore --drop --archive="atlas.archive" --nsFrom="gym.*" --nsTo="gym.*" --uri="mongodb://127.0.0.1:27017"
```

Xong thì xóa file archive đi:

```bash
del atlas.archive
```

### 4.3 Kiểm tra

- Mở Compass, bấm connection **Local** (`mongodb://127.0.0.1:27017`)
- Chọn database `gym` → click vào các collection, dữ liệu phải giống Atlas

## 5. Khi nào cần đồng bộ lại?

Chạy lại lệnh ở bước 4.2 bất cứ khi nào muốn cập nhật dữ liệu mới từ Atlas xuống local (ví dụ: mỗi sáng trước khi code, hoặc khi có dữ liệu mới trên Atlas).

## 6. Chạy app backend

```bash
cd gym-backend
npm install
npm run dev
```

App sẽ tự động:
- Nếu có mạng + Atlas truy cập được → dùng Atlas
- Nếu Atlas bị chặn hoặc mất mạng → tự chuyển sang local (`mongodb://127.0.0.1:27017/gym`), chỉ xem được dữ liệu, không ghi được
- Khi có mạng trở lại → restart app để quay về Atlas

## 7. Lưu ý

- **Local chỉ để đọc.** Không tạo/sửa/xóa dữ liệu qua app khi đang fallback.
- **Atlas là chính.** Mọi thao tác đọc/ghi đều trên Atlas.
- **Không cần làm gì thêm.** Code fallback đã được xử lý sẵn trong backend.
