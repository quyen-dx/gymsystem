import Plan from '../models/Plan.js';
import Membership from '../models/Membership.js';
import { recordAuditLog } from '../services/auditLogService.js';

// ==================== TẠO GÓI TẬP ====================
export const createPlan = async (req, res) => {
  try {
    const { name, price, durationDays, description, color } = req.body;

    const plan = await Plan.create({ name, price, durationDays, description, color });
    await recordAuditLog({
      req,
      module: 'plans',
      action: 'create',
      entity: plan,
      details: 'Tạo gói tập',
    });

    res.status(201).json({ message: 'Tạo gói tập thành công', plan });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
};

// ==================== LẤY DANH SÁCH GÓI TẬP ====================
export const getPlans = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      isActive,
    } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    // Admin có thể lọc theo trạng thái, còn lại chỉ thấy gói đang active
    if (req.user?.role === 'admin') {
      if (isActive !== undefined) filter.isActive = isActive === 'true';
    } else {
      filter.isActive = true;
    }

    const total = await Plan.countDocuments(filter);
    const plans = await Plan.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Lấy số member đang dùng từng gói (chỉ active memberships)
    const plansWithMemberCount = await Promise.all(
      plans.map(async (plan) => {
        const memberCount = await Membership.countDocuments({
          planId: plan._id,
          status: 'active',
        });
        return { ...plan.toObject(), memberCount };
      })
    );

    res.json({
      plans: plansWithMemberCount,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== LẤY CHI TIẾT GÓI TẬP ====================
export const getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Không tìm thấy gói tập' });
    }

    const memberCount = await Membership.countDocuments({
      planId: plan._id,
      status: 'active',
    });

    res.json({ plan: { ...plan.toObject(), memberCount } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== CẬP NHẬT GÓI TẬP ====================
export const updatePlan = async (req, res) => {
  try {
    const { name, price, durationDays, description, color } = req.body;

    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Không tìm thấy gói tập' });
    }

    plan.name = name;
    plan.price = price;
    plan.durationDays = durationDays;
    plan.description = description;
    plan.color = color;
    await plan.save();
    await recordAuditLog({
      req,
      module: 'plans',
      action: 'update',
      entity: plan,
      details: 'Cập nhật thông tin gói tập',
    });

    res.json({ message: 'Cập nhật gói tập thành công', plan });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
};

// ==================== XOÁ GÓI TẬP ====================
export const deletePlan = async (req, res) => {
  try {
    // Kiểm tra có member đang dùng không
    const activeCount = await Membership.countDocuments({
      planId: req.params.id,
      status: 'active',
    });

    if (activeCount > 0) {
      return res.status(400).json({
        message: `Không thể xóa. Có ${activeCount} member đang sử dụng gói này. Hãy vô hiệu hóa thay vì xóa.`,
      });
    }

    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Không tìm thấy gói tập' });
    }
    await recordAuditLog({
      req,
      module: 'plans',
      action: 'delete',
      entity: plan,
      details: 'Xóa gói tập',
    });

    res.json({ message: 'Xóa gói tập thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== KÍCH HOẠT / VÔ HIỆU HOÁ GÓI TẬP ====================
export const togglePlanStatus = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Không tìm thấy gói tập' });
    }

    plan.isActive = !plan.isActive;
    await plan.save();
    await recordAuditLog({
      req,
      module: 'plans',
      action: 'update',
      entity: plan,
      details: plan.isActive ? 'Kích hoạt gói tập' : 'Vô hiệu hóa gói tập',
    });

    res.json({
      message: `Gói tập đã được ${plan.isActive ? 'kích hoạt' : 'vô hiệu hóa'}`,
      plan,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
