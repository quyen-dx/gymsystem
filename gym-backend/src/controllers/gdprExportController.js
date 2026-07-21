import { exportMemberData, anonymizeMemberData } from '../services/gdprExportService.js'
import { recordAuditLog } from '../services/auditLogService.js'
import AppError from '../utils/appError.js'

export const exportUserData = async (req, res, next) => {
    try {
        const data = await exportMemberData(req.params.userId)
        if (!data) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' })
        }

        await recordAuditLog({
            req,
            module: 'users',
            action: 'update',
            entity: { _id: req.params.userId, name: data.profile?.email || data.profile?.name },
            details: 'GDPR data export requested',
        })

        return res.json({ success: true, data })
    } catch (error) {
        next(error)
    }
}

export const anonymizeUserData = async (req, res, next) => {
    try {
        const result = await anonymizeMemberData(req.params.userId)
        if (!result) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' })
        }

        await recordAuditLog({
            req,
            module: 'users',
            action: 'delete',
            entity: { _id: req.params.userId, name: result.userId },
            details: 'GDPR data anonymization — PII scrubbed, financial records retained',
        })

        return res.json({
            success: true,
            data: result,
            message: 'Dữ liệu người dùng đã được ẩn danh. Hồ sơ tài chính được giữ lại theo quy định.',
        })
    } catch (error) {
        next(error)
    }
}
