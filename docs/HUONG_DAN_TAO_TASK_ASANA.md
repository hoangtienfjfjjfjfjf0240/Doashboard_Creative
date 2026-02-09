# 📋 Hướng Dẫn Tạo Task Asana Cho Creative Dashboard

## Tổng Quan

Dashboard này đo lường hiệu suất dựa trên dữ liệu từ Asana. Để đảm bảo dữ liệu được đồng bộ và tính toán chính xác, cần tuân thủ cách tạo task dưới đây.

---

## 🏗️ Cấu Trúc Board Asana

### Các Section (Cột) Bắt Buộc

| Section | Ý nghĩa | Trạng thái trong Dashboard |
|---------|---------|---------------------------|
| **Doing** 🔥 | Đang thực hiện | `not_done` |
| **Check** ❓ | Chờ kiểm tra | `not_done` |
| **Done This Week** ✅ | Hoàn thành trong tuần | `done` |

> ⚠️ **Quan trọng**: Chỉ task trong section "Done This Week" mới được tính điểm!

---

## 📝 Custom Fields Bắt Buộc

Mỗi task **PHẢI** có đầy đủ các custom fields sau:

### 1. **Assignee** (Người thực hiện)
- Chọn đúng người thực hiện task
- Dashboard sẽ tính điểm theo từng người

### 2. **Due Date** (Ngày hoàn thành)
- Set ngày deadline của task
- Dùng để theo dõi tiến độ và lọc theo tuần

### 3. **Priority Task** (Mức độ ưu tiên)
| Giá trị | Ý nghĩa |
|---------|---------|
| Low | Ưu tiên thấp |
| Normal | Bình thường |
| High | Ưu tiên cao |

### 4. **Progress** (Trạng thái)
| Giá trị | Ý nghĩa |
|---------|---------|
| Not Done | Chưa hoàn thành |
| Done | Đã hoàn thành |

> 💡 **Lưu ý**: Khi hoàn thành task, nhớ chuyển Progress sang "Done" VÀ kéo task vào section "Done This Week"

### 5. **Video Type** (Loại video) ⭐ QUAN TRỌNG
Quy định điểm số cho mỗi loại video:

| Code | Mô tả | Điểm |
|------|-------|------|
| S1 | Loại 1 | 3 |
| S2A | Loại 2A | 2 |
| S2B | Loại 2B | 2.5 |
| S3A | Loại 3A | 2 |
| S3B | Loại 3B | 5 |
| S4 | Loại 4 | 5 |
| S5 | Loại 5 | 6 |
| S6 | Loại 6 | 7 |
| S7 | Loại 7 | 10 |
| S8 | Loại 8 | 48 |
| S9A | Loại 9A | 2.5 |
| S9B | Loại 9B | 4 |
| S9C | Loại 9C | 7 |

### 6. **Video Count** (Số lượng video)
- Nhập số lượng video trong task
- Ví dụ: 1, 2, 5...
- **Công thức điểm**: `Điểm = Video Type × Video Count`

### 7. **CTST** (Creative Tool - Cải Tiến Sáng Tạo)
Theo dõi việc sử dụng công cụ AI/cải tiến:

| Giá trị | Ý nghĩa |
|---------|---------|
| Translate Tool | Sử dụng tool dịch |
| Media tool | Sử dụng media tool |
| Voice Clone | Sử dụng voice clone |
| Flow veo3 | Sử dụng Flow veo3 |
| Sora | Sử dụng Sora |

> 💡 Field này dùng để thống kê % sử dụng công cụ cải tiến

---

## 📐 Cách Tính Điểm

```
Điểm Task = Điểm Video Type × Số lượng Video (Video Count)
```

**Ví dụ:**
- Task với Video Type = S5 (6 điểm), Video Count = 7
- Điểm = 6 × 7 = **42 điểm**

---

## 🎯 Mục Tiêu Hàng Tuần

| Metrics | Target |
|---------|--------|
| Điểm/tuần/người | **160 điểm** |
| EKS (6 tháng) | **4.200 điểm** |

---

## ✅ Checklist Tạo Task Chuẩn

Trước khi tạo task, đảm bảo:

- [ ] Đặt tên task rõ ràng, mô tả công việc
- [ ] Chọn đúng **Assignee**
- [ ] Set **Due Date**
- [ ] Chọn **Priority Task** (Low/Normal/High)
- [ ] Chọn **Video Type** (S1-S9C)
- [ ] Nhập **Video Count** (số lượng)
- [ ] Chọn **CTST** nếu có sử dụng công cụ cải tiến
- [ ] Để task trong section **Doing** khi bắt đầu làm

---

## 🔄 Quy Trình Hoàn Thành Task

1. **Bắt đầu task**: Kéo vào section "Doing"
2. **Cần review**: Kéo vào section "Check"
3. **Hoàn thành**:
   - Chuyển Progress → "Done"
   - Kéo task vào section "Done This Week"
4. **Sync Dashboard**: Nhấn nút "Sync Now" trên Dashboard

---

## 📊 Cách Xem Báo Cáo

### Trên Dashboard:
1. **Total Points**: Tổng điểm trong khoảng thời gian chọn
2. **Done Tasks**: Số task đã hoàn thành
3. **Leaderboard**: Bảng xếp hạng thành viên
4. **CTST Chart**: Biểu đồ sử dụng công cụ cải tiến

### Filters:
- **Week Selector**: Chọn tuần/khoảng thời gian
- **Member Filter**: Lọc theo người (với Admin/Lead)
- **Status Filter**: All / Done / Not Done

---

## ⚠️ Lưu Ý Quan Trọng

1. **Sync thường xuyên**: Nhấn "Sync Now" sau khi cập nhật task trên Asana
2. **Hoàn thành đúng section**: Task phải ở "Done This Week" mới được tính điểm
3. **Điền đầy đủ fields**: Thiếu Video Type hoặc Video Count sẽ không tính được điểm
4. **Ngày nghỉ**: Đăng ký trên Dashboard để điều chỉnh target

---

## 🔧 Thiết Lập Custom Fields Trong Asana

Nếu chưa có custom fields, tạo như sau:

1. Mở Project Settings → Custom Fields
2. Tạo các fields:

| Field Name | Type | Options |
|------------|------|---------|
| Priority Task | Dropdown | Low, Normal, High |
| Progress | Dropdown | Not Done, Done |
| Video Type | Dropdown | S1, S2A, S2B, S3A, S3B, S4, S5, S6, S7, S8, S9A, S9B, S9C |
| Video Count | Number | - |
| CTST | Dropdown | Translate Tool, Media tool, Voice Clone, Flow veo3, Sora |

---

## 📞 Hỗ Trợ

Nếu có vấn đề về:
- **Dashboard không sync**: Kiểm tra kết nối internet và ASANA_ACCESS_TOKEN
- **Điểm tính sai**: Kiểm tra Video Type và Video Count của task
- **Không thấy task**: Đảm bảo task ở đúng section và có đủ custom fields

---

*Cập nhật: Tháng 02/2026*
