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

export const createTransferRequest = async (req, res, next) => {
  try { res.status(201).json({ data: await createMembershipTransferRequest({ senderId: req.user._id, recipientLookup: req.body?.recipient, note: req.body?.note }) }) } catch (error) { next(error) }
}
export const getMyTransferRequests = async (req, res, next) => {
  try { res.json({ data: await getMyMembershipTransferRequests(req.user._id) }) } catch (error) { next(error) }
}
export const searchTransferRecipients = async (req, res, next) => {
  try { res.json({ data: await searchEligibleMembershipTransferRecipients({ senderId: req.user._id, search: req.query.search }) }) } catch (error) { next(error) }
}
export const respondToTransferRequest = async (req, res, next) => {
  try { res.json({ data: await respondToMembershipTransferRequest({ recipientId: req.user._id, requestId: req.params.id, accept: Boolean(req.body?.accept) }) }) } catch (error) { next(error) }
}
export const cancelTransferRequest = async (req, res, next) => {
  try { res.json({ data: await cancelMembershipTransferRequest({ senderId: req.user._id, requestId: req.params.id }) }) } catch (error) { next(error) }
}
export const listTransferRequestsForStaff = async (req, res, next) => {
  try { res.json({ data: await listMembershipTransferRequestsForStaff({ status: req.query.status }) }) } catch (error) { next(error) }
}
export const approveTransferRequest = async (req, res, next) => {
  try { res.json({ data: await approveMembershipTransferRequest({ requestId: req.params.id, staffId: req.user._id }) }) } catch (error) { next(error) }
}
export const rejectTransferRequest = async (req, res, next) => {
  try { res.json({ data: await rejectMembershipTransferRequest({ requestId: req.params.id, staffId: req.user._id, reason: req.body?.reason }) }) } catch (error) { next(error) }
}
