import PlanFeature from '../models/PlanFeature.js';
import { recordAuditLog } from '../services/auditLogService.js';

export const getAll = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 50 } = req.query;

    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const total = await PlanFeature.countDocuments(filter);
    const features = await PlanFeature.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      data: features,
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

export const getById = async (req, res) => {
  try {
    const feature = await PlanFeature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ message: 'Không tìm thấy tính năng' });
    }

    res.json({ feature });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const { code, name, description, isSystem } = req.body;

    const exists = await PlanFeature.findOne({ code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: `Mã tính năng "${code}" đã tồn tại` });
    }

    const feature = await PlanFeature.create({
      code,
      name,
      description,
      isSystem,
    });

    await recordAuditLog({
      req,
      module: 'planFeatures',
      action: 'create',
      entity: feature,
      details: `Tạo tính năng "${feature.name}" (${feature.code})`,
    });

    res.status(201).json({ message: 'Tạo tính năng thành công', feature });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const { code, name, description, isSystem, isActive } = req.body;

    const feature = await PlanFeature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ message: 'Không tìm thấy tính năng' });
    }

    if (code && code.toUpperCase() !== feature.code) {
      const dup = await PlanFeature.findOne({
        code: code.toUpperCase(),
        _id: { $ne: feature._id },
      });
      if (dup) {
        return res.status(400).json({ message: `Mã tính năng "${code}" đã tồn tại` });
      }
    }

    if (code !== undefined) feature.code = code;
    if (name !== undefined) feature.name = name;
    if (description !== undefined) feature.description = description;
    if (isSystem !== undefined) feature.isSystem = isSystem;
    if (isActive !== undefined) feature.isActive = isActive;

    await feature.save();

    await recordAuditLog({
      req,
      module: 'planFeatures',
      action: 'update',
      entity: feature,
      details: `Cập nhật tính năng "${feature.name}" (${feature.code})`,
    });

    res.json({ message: 'Cập nhật tính năng thành công', feature });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
};

export const toggleActive = async (req, res) => {
  try {
    const feature = await PlanFeature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ message: 'Không tìm thấy tính năng' });
    }

    feature.isActive = !feature.isActive;
    await feature.save();

    await recordAuditLog({
      req,
      module: 'planFeatures',
      action: 'update',
      entity: feature,
      details: feature.isActive
        ? `Kích hoạt tính năng "${feature.name}"`
        : `Vô hiệu hóa tính năng "${feature.name}"`,
    });

    res.json({
      message: `Tính năng đã được ${feature.isActive ? 'kích hoạt' : 'vô hiệu hóa'}`,
      feature,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
