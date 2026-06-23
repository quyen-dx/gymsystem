import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFaqPolicyAnswer, inferFaqCategory, inferPolicyCategory, isPolicyQuery, isSupportFaqQuery } from './faqPolicySearchService.js'

test('FAQ support intent detects account/navigation questions', () => {
  assert.equal(isSupportFaqQuery('đổi mật khẩu ở đâu'), true)
  assert.equal(inferFaqCategory('tôi quên mật khẩu phải làm sao'), 'Tài khoản')
  assert.equal(inferFaqCategory('đăng ký gói tập thế nào'), 'Gói tập')
})

test('Policy intent detects refund and privacy questions', () => {
  assert.equal(isPolicyQuery('hoàn tiền như nào'), true)
  assert.equal(inferPolicyCategory('hoàn tiền như nào'), 'Hoàn tiền')
  assert.equal(inferPolicyCategory('chính sách bảo mật'), 'Bảo mật')
})

test('FAQ answer is natural text and adds password navigation', () => {
  const answer = buildFaqPolicyAnswer({
    query: 'đổi mật khẩu ở đâu',
    language: 'vi',
    faqSearch: {
      matched: {
        questionVi: 'Tôi quên mật khẩu phải làm sao?',
        answerVi: 'Chọn Quên mật khẩu ở màn đăng nhập, nhập email để nhận OTP rồi đặt mật khẩu mới.',
        categoryVi: 'Tài khoản',
      },
    },
  })

  assert.match(answer, /Quên mật khẩu/)
  assert.match(answer, /Tài khoản → Tài khoản & Bảo mật → Đổi mật khẩu/)
  assert.doesNotMatch(answer, /\{|\}|matched|score/)
})

test('FAQ answer falls back to navigation when no FAQ exists for password change location', () => {
  const answer = buildFaqPolicyAnswer({
    query: 'đổi mật khẩu ở đâu',
    language: 'vi',
    faqSearch: { matched: null },
  })

  assert.equal(answer, 'Bạn vào Tài khoản → Tài khoản & Bảo mật → Đổi mật khẩu.')
})
