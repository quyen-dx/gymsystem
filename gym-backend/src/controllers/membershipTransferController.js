import {
  approveMembershipTransferRequest,
  cancelMembershipTransferRequest,
  createMembershipTransferRequest,
  getMyMembershipTransferRequests,
  listMembershipTransferRequestsForStaff,
  rejectMembershipTransferRequest,
  respondToMembershipTransferRequest,
  searchEligibleMembershipTransferRecipients,
} from '../services/membershipTransferService.js'
import { recordAuditLog } from '../services/auditLogService.js'

const auditTransfer = (req, action, entity, details) => recordAuditLog({
  req,
  module: 'membership_transfer',
  action,
  entity,
  entityName: `Chuyển nhượng gói ${entity?._id || ''}`.trim(),
  details,
}).catch(() => {})

export const createTransferRequest = async (req, res, next) => {
  try {
    const data = await createMembershipTransferRequest({ senderId: req.user._id, recipientLookup: req.body?.recipient, note: req.body?.note })
    auditTransfer(req, 'create', data, 'Tạo yêu cầu chuyển nhượng gói tập')
    res.status(201).json({ data })
  } catch (error) { next(error) }
}
export const getMyTransferRequests = async (req, res, next) => {
  try { res.json({ data: await getMyMembershipTransferRequests(req.user._id) }) } catch (error) { next(error) }
}
export const searchTransferRecipients = async (req, res, next) => {
  try { res.json({ data: await searchEligibleMembershipTransferRecipients({ senderId: req.user._id, search: req.query.search }) }) } catch (error) { next(error) }
}
export const respondToTransferRequest = async (req, res, next) => {
  try {
    const accept = req.body?.accept === true || req.body?.accept === 'true'
    const data = await respondToMembershipTransferRequest({ recipientId: req.user._id, requestId: req.params.id, accept })
    auditTransfer(req, accept ? 'recipient_accept' : 'recipient_reject', data, accept ? 'Hội viên nhận xác nhận nhận gói' : 'Hội viên nhận từ chối nhận gói')
    res.json({ data })
  } catch (error) { next(error) }
}
export const cancelTransferRequest = async (req, res, next) => {
  try {
    const data = await cancelMembershipTransferRequest({ senderId: req.user._id, requestId: req.params.id })
    auditTransfer(req, 'cancel', data, 'Người gửi hủy yêu cầu chuyển nhượng')
    res.json({ data })
  } catch (error) { next(error) }
}
export const listTransferRequestsForStaff = async (req, res, next) => {
  try { res.json({ data: await listMembershipTransferRequestsForStaff({ status: req.query.status }) }) } catch (error) { next(error) }
}
export const approveTransferRequest = async (req, res, next) => {
  try {
    const data = await approveMembershipTransferRequest({ requestId: req.params.id, staffId: req.user._id })
    auditTransfer(req, 'approve', data, 'Duyệt chuyển nhượng; đã hủy booking, PT/lớp và giáo án đang hoạt động của người chuyển')
    res.json({ data })
  } catch (error) { next(error) }
}
export const rejectTransferRequest = async (req, res, next) => {
  try {
    const data = await rejectMembershipTransferRequest({ requestId: req.params.id, staffId: req.user._id, reason: req.body?.reason })
    auditTransfer(req, 'reject', data, `Từ chối chuyển nhượng: ${data.rejectionReason || ''}`)
    res.json({ data })
  } catch (error) { next(error) }
}
