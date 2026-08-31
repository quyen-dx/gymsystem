import {
  approvePayoutRequest, cancelPayoutRequest, confirmPayoutReceived, createPayoutRequest, disputePayoutRequest,
  getAdminPayoutRequest, getMemberPayoutRequest, getMemberPayoutRequests, getWalletPayoutSummary, listAdminPayoutRequests,
  markPayoutTransferred, rejectPayoutRequest, resolvePayoutDispute,
} from '../services/payoutRequestService.js'
import { recordAuditLog } from '../services/auditLogService.js'

const proofUrl = (req) => req.file?.path || req.file?.secure_url || req.body?.transferProof
const auditPayout = (req, action, entity, details) => recordAuditLog({
  req,
  module: 'payout_request',
  action,
  entity,
  entityName: `Yêu cầu rút tiền ${entity?._id || ''}`.trim(),
  details,
}).catch(() => {})

export const createMyPayoutRequest = async (req, res, next) => { try { const data = await createPayoutRequest({ memberId: req.user._id, payload: req.body }); auditPayout(req, 'create', data, `Tạo yêu cầu rút ${Number(data.amount || 0).toLocaleString('vi-VN')}đ`); res.status(201).json({ success: true, data }) } catch (error) { next(error) } }
export const listMyPayoutRequests = async (req, res, next) => { try { res.json({ success: true, data: await getMemberPayoutRequests(req.user._id) }) } catch (error) { next(error) } }
export const getMyPayoutRequest = async (req, res, next) => { try { res.json({ success: true, data: await getMemberPayoutRequest({ memberId: req.user._id, payoutRequestId: req.params.id }) }) } catch (error) { next(error) } }
export const cancelMyPayoutRequest = async (req, res, next) => { try { const data = await cancelPayoutRequest({ memberId: req.user._id, payoutRequestId: req.params.id }); auditPayout(req, 'cancel', data, 'Hội viên hủy yêu cầu rút tiền'); res.json({ success: true, data }) } catch (error) { next(error) } }
export const confirmMyPayoutReceived = async (req, res, next) => { try { const data = await confirmPayoutReceived({ memberId: req.user._id, payoutRequestId: req.params.id }); auditPayout(req, 'member_confirm_received', data, 'Hội viên xác nhận đã nhận tiền'); res.json({ success: true, data }) } catch (error) { next(error) } }
export const disputeMyPayoutRequest = async (req, res, next) => { try { const data = await disputePayoutRequest({ memberId: req.user._id, payoutRequestId: req.params.id, reason: req.body?.reason }); auditPayout(req, 'member_dispute', data, `Hội viên khiếu nại: ${req.body?.reason || ''}`); res.json({ success: true, data }) } catch (error) { next(error) } }
export const getMyPayoutSummary = async (req, res, next) => { try { res.json({ success: true, data: await getWalletPayoutSummary(req.user._id) }) } catch (error) { next(error) } }

export const listAdminPayoutRequestsController = async (req, res, next) => { try { res.json({ success: true, data: await listAdminPayoutRequests(req.query) }) } catch (error) { next(error) } }
export const getAdminPayoutRequestController = async (req, res, next) => { try { res.json({ success: true, data: await getAdminPayoutRequest(req.params.id) }) } catch (error) { next(error) } }
export const approvePayoutRequestController = async (req, res, next) => { try { const data = await approvePayoutRequest({ payoutRequestId: req.params.id, adminId: req.user._id }); auditPayout(req, 'approve', data, 'Admin duyệt yêu cầu rút tiền'); res.json({ success: true, data }) } catch (error) { next(error) } }
export const rejectPayoutRequestController = async (req, res, next) => { try { const data = await rejectPayoutRequest({ payoutRequestId: req.params.id, adminId: req.user._id, reason: req.body?.reason }); auditPayout(req, 'reject', data, `Admin từ chối: ${req.body?.reason || ''}`); res.json({ success: true, data }) } catch (error) { next(error) } }
export const markPayoutTransferredController = async (req, res, next) => { try { const data = await markPayoutTransferred({ payoutRequestId: req.params.id, adminId: req.user._id, transferProof: proofUrl(req) }); auditPayout(req, 'mark_transferred', data, 'Admin đã gửi minh chứng chuyển khoản'); res.json({ success: true, data }) } catch (error) { next(error) } }
export const resolvePayoutDisputeController = async (req, res, next) => { try { const data = await resolvePayoutDispute({ payoutRequestId: req.params.id, adminId: req.user._id, action: req.body?.action, transferProof: proofUrl(req), resolutionNote: req.body?.resolutionNote }); auditPayout(req, 'resolve_dispute', data, `Xử lý khiếu nại: ${req.body?.action || ''}. ${req.body?.resolutionNote || ''}`); res.json({ success: true, data }) } catch (error) { next(error) } }
