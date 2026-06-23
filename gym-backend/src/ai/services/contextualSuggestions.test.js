import test from 'node:test'
import assert from 'node:assert/strict'

import { buildContextualSuggestions } from './contextualSuggestions.js'

test('contextual suggestions follow check-in intent', () => {
  const suggestions = buildContextualSuggestions({
    query: 'Tôi đã check-in bao nhiêu lần tháng này?',
    intent: 'checkin_summary',
    subject: 'checkin',
    answer: 'Tháng này bạn đã check-in 2 buổi.',
    toolData: { checkinStats: { thisMonth: 2, last30Days: 2, totalFetched: 2 } },
    language: 'vi',
  })

  assert.deepEqual(suggestions, [
    'Tôi đã check-in bao nhiêu lần tuần này?',
    'Lần check-in gần nhất của tôi?',
    'Chuỗi điểm danh hiện tại là bao nhiêu ngày?',
    'Tôi đã tập bao nhiêu buổi tháng này?',
  ])
  assert.ok(suggestions.every((item) => !/gói|tăng cơ|chế độ ăn|protein/i.test(item)))
})

test('contextual suggestions follow membership intent', () => {
  const suggestions = buildContextualSuggestions({
    query: 'Tôi đang sử dụng gói gì?',
    intent: 'membership_status',
    subject: 'membership',
    answer: 'Bạn đang sử dụng Gói Cơ Bản.',
    language: 'vi',
  })

  assert.deepEqual(suggestions, [
    'Gói tập của tôi còn bao nhiêu ngày?',
    'Khi nào gói tập hết hạn?',
    'Tôi có thể gia hạn gói tập không?',
    'Quyền lợi của gói hiện tại là gì?',
  ])
})

test('contextual suggestions follow nutrition and progress intents', () => {
  const nutrition = buildContextualSuggestions({
    query: 'Tôi nên ăn gì để tăng cơ?',
    intent: 'nutrition_advice',
    subject: 'nutrition',
    answer: 'Để tăng cơ, bạn nên ăn đủ đạm.',
    language: 'vi',
  })
  assert.deepEqual(nutrition, [
    'Tôi cần bao nhiêu protein mỗi ngày?',
    'Thực đơn tăng cơ cho người mới?',
    'Tôi nên ăn trước khi tập gì?',
    'Tôi nên ăn sau khi tập gì?',
  ])

  const progress = buildContextualSuggestions({
    query: 'Tôi giảm được bao nhiêu cân?',
    intent: 'workout_progress',
    subject: 'progress',
    answer: 'Chưa có dữ liệu tiến độ cân nặng.',
    language: 'vi',
  })
  assert.deepEqual(progress, [
    'Cân nặng thay đổi trong 30 ngày qua?',
    'Tiến độ giảm mỡ hiện tại?',
    'Tôi có đang đạt mục tiêu không?',
    'Thống kê cơ thể mới nhất?',
  ])
})
