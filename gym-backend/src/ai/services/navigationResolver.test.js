import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNavigationAnswer, resolveNavigation } from './navigationResolver.js'

test('member navigation resolves member routes', async () => {
  const cases = [
    ['xem lịch của tôi ở đâu', '/booking'],
    ['đặt lịch PT ở đâu', '/booking'],
    ['check-in ở đâu', '/checkin'],
    ['đổi mật khẩu ở đâu', '/account/profile'],
    ['quên mật khẩu', '/forgot-password'],
    ['xem đơn hàng ở đâu', '/orders'],
    ['xem sức khỏe ở đâu', '/health'],
    ['xem lộ trình ở đâu', '/workout'],
    ['xem FAQ', '/help'],
    ['xem chính sách hoàn tiền', '/policies'],
    ['mua whey ở đâu', '/store'],
  ]

  for (const [query, expectedPath] of cases) {
    const nav = await resolveNavigation({ query, userRole: 'member', featureFlags: { 'pt.memberBookingEnabled': true }, logDocs: false })
    assert.equal(nav.path, expectedPath, query)
    assert.equal(nav.blocked, false, query)
  }
})

test('role specific navigation resolves without leaking routes', async () => {
  assert.equal((await resolveNavigation({ query: 'xem lịch của tôi ở đâu', userRole: 'pt', logDocs: false })).path, '/pt/schedule')
  assert.equal((await resolveNavigation({ query: 'lịch chờ xác nhận ở đâu', userRole: 'pt', logDocs: false })).path, '/pt/schedule/pending')
  assert.equal((await resolveNavigation({ query: 'quét QR ở đâu', userRole: 'staff', logDocs: false })).path, '/staff/checkin')
  assert.equal((await resolveNavigation({ query: 'quản lý PT ở đâu', userRole: 'admin', logDocs: false })).path, '/admin/trainers')
  assert.equal((await resolveNavigation({ query: 'thêm sản phẩm ở đâu', userRole: 'seller', logDocs: false })).path, '/seller/products/create')
})

test('member cannot receive admin or pt-only route', async () => {
  const adminNav = await resolveNavigation({ query: 'vào admin ở đâu', userRole: 'member', logDocs: false })
  assert.equal(adminNav.blocked, true)
  assert.equal(adminNav.reason, 'role_denied')
  assert.notEqual(adminNav.path, '/admin')

  const ptSchedule = await resolveNavigation({ query: 'xem lịch PT ở đâu', userRole: 'member', featureFlags: { 'pt.memberBookingEnabled': true }, logDocs: false })
  assert.equal(ptSchedule.path, '/booking')
  assert.notEqual(ptSchedule.path, '/pt/schedule')
})

test('disabled feature flag suppresses navigation link', async () => {
  const nav = await resolveNavigation({ query: 'đặt lịch PT ở đâu', userRole: 'member', featureFlags: { 'pt.memberBookingEnabled': false }, logDocs: false })
  assert.equal(nav.blocked, true)
  assert.equal(nav.reason, 'feature_disabled')
  const answer = buildNavigationAnswer({ navigation: nav, lang: 'vi' })
  assert.equal(answer.links.length, 0)
  assert.match(answer.answer, /bị tắt/)
})
