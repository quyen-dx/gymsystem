/**
 * Nghiệp vụ "buổi giáo án" (Workout Plan) tách khỏi "buổi lịch" (Workout Schedule).
 *
 * - Mỗi slot (session) trong WorkoutSchedule mang `templateSessionIndex` = vị trí buổi
 *   trong template (1-based). Slot thứ j được gán buổi thứ j của giáo án.
 * - Giáo án có M buổi, member chỉ có N slot (N <= M): các buổi N+1..M KHÔNG có slot
 *   → trạng thái WAITING (đang chờ, chưa xóa, chưa hoàn thành).
 * - Khi member có thêm buổi PT, PT thêm slot mới → slot đó nhận BUỔI KẾ TIẾP chưa
 *   hoàn thành trong giáo án (cursor). Buổi đã hủy (slot cancelled) KHÔNG tính là
 *   hoàn thành và vẫn là buổi tiếp theo khi có slot mới.
 * - Hoàn thành: chỉ khi slot tương ứng được đánh dấu completed. Không tự động
 *   chuyển trạng thái của buổi khác.
 */

const DAY_STATUS = {
  WAITING: 'waiting',
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

/**
 * Gán templateSessionIndex cho các session theo THỨ TỰ NGÀY THỰC TẾ (date, rồi dayOrder):
 * slot có ngày sớm nhất ↔ Buổi 1, slot tiếp ↔ Buổi 2, ...
 * Đồng thời BUILD LẠI NỘI DUNG slot từ template.days[index-1] — slot j mang ĐÚNG
 * nội dung buổi j của giáo án (title, muscleGroup, exercises), chỉ giữ lại
 * thời gian/địa điểm (date, time, endTime, className, classCode, location) PT đã chọn.
 * Quan trọng khi member có lịch nhiều tuần (mỗi tuần 1 WorkoutSchedule):
 * - Tuần 1: T2→Buổi 1, T3→Buổi 2
 * - Tuần 2: T2→Buổi 3, T3→Buổi 4
 * - Giáo án 5 buổi nhưng chỉ có 4 slot → buổi 5 KHÔNG có slot → trạng thái WAITING (tạm bỏ, mở lại khi có thêm buổi).
 * Session vượt quá số buổi của template → index = null (PT tự soạn nội dung sau).
 */
export const assignTemplateIndexes = ({ template, sessions = [] }) => {
  const days = template?.days || []
  return [...sessions]
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0
      const dateB = new Date(b.date).getTime() || 0
      if (dateA !== dateB) return dateA - dateB
      return (a.dayOrder || 0) - (b.dayOrder || 0)
    })
    .map((s, idx) => {
      const day = days[idx]
      const base = { ...s, templateSessionIndex: day ? idx + 1 : null }
      if (!day) return base
      return {
        ...base,
        title: day.title || day.muscleGroup || `Buổi ${idx + 1}`,
        muscleGroup: day.muscleGroup || '',
        exercises: (day.exercises || []).map((ex) => ({ name: ex.name, note: ex.note || '', completed: false })),
      }
    })
}

const slotToDayStatus = (slot) => {
  if (!slot) return null
  if (slot.status === 'completed') return DAY_STATUS.COMPLETED
  if (['cancelled', 'skipped', 'no_show'].includes(slot.status)) return DAY_STATUS.CANCELLED
  return DAY_STATUS.SCHEDULED
}

/**
 * Tính trạng thái từng buổi của giáo án dựa trên các slot đã gán.
 * Mỗi buổi i của template:
 *  - có slot (ưu tiên slot không bị hủy) → completed / scheduled / cancelled
 *  - không có slot nào → waiting (đang chờ buổi PT hợp lệ)
 *
 * @returns {Array<{ index, title, muscleGroup, status, slotDate, slotTime }>}
 */
export const computePlanProgress = ({ template, sessions = [] }) => {
  const days = template?.days || []
  return days.map((day, i) => {
    const index = i + 1
    const slots = sessions.filter((s) => s.templateSessionIndex === index)
    // Ưu tiên slot chưa bị hủy để xác định trạng thái hiện tại; nếu toàn bộ đã hủy → cancelled
    const live = slots.find((s) => s.status === 'pending') || slots[slots.length - 1] || null
    const status = slots.length === 0 ? DAY_STATUS.WAITING : (slotToDayStatus(live) || DAY_STATUS.WAITING)
    return {
      index,
      title: day.title || day.muscleGroup || `Buổi ${index}`,
      muscleGroup: day.muscleGroup || '',
      status,
      slotDate: live ? live.date : null,
      slotTime: live ? live.time || '' : '',
    }
  })
}

/**
 * Buổi tiếp theo trong giáo án có thể gán cho slot mới:
 * buổi nhỏ nhất CHƯA CÓ slot hợp lệ (pending hoặc completed).
 *  - Buổi đã có slot scheduled (chưa đến ngày tập) → KHÔNG mở lại (tránh trùng buổi
 *    khi member đã có lịch nhiều tuần: tuần 2 có buổi 3,4 thì slot mới phải là buổi 5).
 *  - Slot bị hủy (cancelled/skipped/no_show) → không tính là hợp lệ → buổi đó vẫn là
 *    buổi tiếp theo khi có slot mới.
 */
export const findNextPlanIndex = ({ template, sessions = [] }) => {
  const days = template?.days || []
  const hasLiveSlot = (index) =>
    sessions.some((s) => s.templateSessionIndex === index && ['pending', 'completed'].includes(s.status))
  for (let i = 1; i <= days.length; i++) {
    if (!hasLiveSlot(i)) return i
  }
  return null
}

/**
 * Copy nội dung buổi `index` của template vào một slot mới.
 */
export const buildSessionFromTemplateDay = ({ template, index, base = {} }) => {
  const day = template?.days?.[index - 1]
  return {
    dayOrder: base.dayOrder ?? 0,
    templateSessionIndex: day ? index : null,
    date: base.date ? new Date(base.date) : null,
    time: base.time || '',
    endTime: base.endTime || '',
    className: base.className || '',
    classCode: base.classCode || '',
    location: base.location || '',
    title: (day && (day.title || day.muscleGroup)) || base.title || `Buổi ${index}`,
    muscleGroup: (day && day.muscleGroup) || base.muscleGroup || '',
    exercises: day
      ? (day.exercises || []).map((ex) => ({ name: ex.name, note: ex.note || '', completed: false }))
      : [],
    status: 'pending',
    feedback: '',
    changeHistory: base.changeHistory || [],
  }
}

/**
 * Thông tin gán giáo án cho member: đã gán N/M buổi + danh sách buổi chờ.
 * Dùng cho thông báo mang tính trạng thái (không phải yêu cầu mua thêm).
 */
export const buildPlanSummary = ({ template, sessions = [] }) => {
  const days = template?.days || []
  const progress = computePlanProgress({ template, sessions })
  const assigned = progress.filter((p) => p.status !== DAY_STATUS.WAITING).length
  const waiting = progress.filter((p) => p.status === DAY_STATUS.WAITING)
  const waitingCount = waiting.length

  let message = `Đã gán ${assigned}/${days.length} buổi của giáo án "${template.name || template.goal || ''}" vào lịch tập.`
  if (waitingCount > 0) {
    message = `Giáo án gồm ${days.length} buổi nhưng member hiện có ${assigned} buổi PT khả dụng. Hệ thống đã gán ${assigned} buổi đầu tiên vào các lịch tập hiện có. Buổi tiếp theo sẽ được mở khi member có thêm buổi PT hợp lệ.`
  }
  return { totalDays: days.length, assigned, waitingCount, waiting, progress, message }
}

export default {
  DAY_STATUS,
  assignTemplateIndexes,
  computePlanProgress,
  findNextPlanIndex,
  buildSessionFromTemplateDay,
  buildPlanSummary,
}
