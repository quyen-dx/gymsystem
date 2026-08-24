import {
  approvePayoutRequest, cancelPayoutRequest, confirmPayoutReceived, createPayoutRequest, disputePayoutRequest,
  getAdminPayoutRequest, getMemberPayoutRequest, getMemberPayoutRequests, getWalletPayoutSummary, listAdminPayoutRequests,
  markPayoutTransferred, rejectPayoutRequest, resolvePayoutDispute,
} from '../services/payoutRequestService.js'

const proofUrl = (req) => req.file?.path || req.file?.secure_url || req.body?.transferProof

export const createMyPayoutRequest = async (req, res, next) => { try { const data = await createPayoutRequest({ memberId: req.user._id, payload: req.body }); res.status(201).json({ success: true, data }) } catch (error) { next(error) } }
export const listMyPayoutRequests = async (req, res, next) => { try { res.json({ success: true, data: await getMemberPayoutRequests(req.user._id) }) } catch (error) { next(error) } }
export const getMyPayoutRequest = async (req, res, next) => { try { res.json({ success: true, data: await getMemberPayoutRequest({ memberId: req.user._id, payoutRequestId: req.params.id }) }) } catch (error) { next(error) } }
export const cancelMyPayoutRequest = async (req, res, next) => { try { res.json({ success: true, data: await cancelPayoutRequest({ memberId: req.user._id, payoutRequestId: req.params.id }) }) } catch (error) { next(error) } }
export const confirmMyPayoutReceived = async (req, res, next) => { try { res.json({ success: true, data: await confirmPayoutReceived({ memberId: req.user._id, payoutRequestId: req.params.id }) }) } catch (error) { next(error) } }
export const disputeMyPayoutRequest = async (req, res, next) => { try { res.json({ success: true, data: await disputePayoutRequest({ memberId: req.user._id, payoutRequestId: req.params.id, reason: req.body?.reason }) }) } catch (error) { next(error) } }
export const getMyPayoutSummary = async (req, res, next) => { try { res.json({ success: true, data: await getWalletPayoutSummary(req.user._id) }) } catch (error) { next(error) } }

export const listAdminPayoutRequestsController = async (req, res, next) => { try { res.json({ success: true, data: await listAdminPayoutRequests(req.query) }) } catch (error) { next(error) } }
export const getAdminPayoutRequestController = async (req, res, next) => { try { res.json({ success: true, data: await getAdminPayoutRequest(req.params.id) }) } catch (error) { next(error) } }
export const approvePayoutRequestController = async (req, res, next) => { try { res.json({ success: true, data: await approvePayoutRequest({ payoutRequestId: req.params.id, adminId: req.user._id }) }) } catch (error) { next(error) } }
export const rejectPayoutRequestController = async (req, res, next) => { try { res.json({ success: true, data: await rejectPayoutRequest({ payoutRequestId: req.params.id, adminId: req.user._id, reason: req.body?.reason }) }) } catch (error) { next(error) } }
export const markPayoutTransferredController = async (req, res, next) => { try { res.json({ success: true, data: await markPayoutTransferred({ payoutRequestId: req.params.id, adminId: req.user._id, transferReference: req.body?.transferReference, transferProof: proofUrl(req) }) }) } catch (error) { next(error) } }
export const resolvePayoutDisputeController = async (req, res, next) => { try { res.json({ success: true, data: await resolvePayoutDispute({ payoutRequestId: req.params.id, adminId: req.user._id, action: req.body?.action, transferReference: req.body?.transferReference, transferProof: proofUrl(req), resolutionNote: req.body?.resolutionNote }) }) } catch (error) { next(error) } }
