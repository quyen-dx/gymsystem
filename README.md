## **Mỗi tài khoản chỉ làm 1 lần duy nhất (Bước 1 và bước 2)**

### Bước 1 — Clone repo về

```bash
git clone https://github.com/quyen-dx/gymsystem.git
cd gymsystem
```

### Bước 2 — Tạo nhánh theo chức năng mình làm(luôn ở nhánh của chính mình đéo sang nhánh khác)

```bash
git checkout -b feature/ten-chuc-nang
```

**Ví dụ**

- Làm **member** → `git checkout -b feature/member`
- Làm **check-in** → `git checkout -b feature/checkin`
- Làm **PT** → `git checkout -b feature/pt`
- Làm **đặt lịch** → `git checkout -b feature/booking`
- Làm **Lộ trình & Theo dõi sức khoẻ** → `git checkout -b feature/workout`
- Làm **dashboard** → `git checkout -b feature/dashboard`

<aside>
⚠️

#### Ngày đầu clone về rồi thì **bỏ qua Bước 3**, làm **Bước 4** luôn.

</aside>

---

<aside>
🔁

## **Làm mỗi ngày (Bước 3, 4 và 5)**

</aside>

### Bước 3 — Mối ngày luôn pull code về trước khi làm (đang ở nhanh chính mình thì kéo code mới nhất từ main về)

```bash
git pull origin main
```

### Bước 4 — Code xong thì push lên (❗không được push lên nhánh main hỏng cả git hub đấy)

```bash
git add .
git commit -m "đặt theo chức năng "
git push origin ten-chuc-nang
```

### Bước 5 — mỗi lần code xong  báo tên chức năng cho main 🚀  Trên Zalo

# Chú ý:

- ❗ **KHÔNG** được code trên nhánh `main`
- ✔ Luôn đứng ở nhánh của mình:
    
    ```bash
    git checkout feature/ten-chuc-nang
    ```
    

<aside>
💡

**Tóm lại vòng lặp hằng ngày**

- **Sáng** → pull `main` về lấy code mới nhất
- **Làm** → code tính năng của mình
- **Tối** → push lên nhánh → báo main merge ✅
</aside>