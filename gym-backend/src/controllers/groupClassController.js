import Class from "../models/Class.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

const logAction = async (userId, action, targetId, details = {}) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      module: "GROUP_CLASS",
      targetId,
      details,
    });
  } catch (err) {
    console.error(err.message);
  }
};

export const createClass = async (req, res) => {
  try {
    const { name, ptId, schedule, maxSlots } = req.body;

    const pt = await User.findById(ptId);

    if (!pt || pt.role !== "pt") {
      return res.status(400).json({
        success: false,
        message: "PT không tồn tại",
      });
    }

    const newClass = await Class.create({
      name,
      ptId,
      schedule,
      maxSlots,
      members: [],
    });

    await logAction(
      req.user._id,
      "CREATE_CLASS",
      newClass._id,
      {
        className: name,
      }
    );

    return res.status(201).json({
      success: true,
      data: newClass,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("ptId", "name avatar")
      .populate("members", "name avatar memberCode");

    return res.json({
      success: true,
      count: classes.length,
      data: classes,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getClassById = async (req, res) => {
  try {
    const gymClass = await Class.findById(req.params.id)
      .populate("ptId")
      .populate("members");

    if (!gymClass) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp",
      });
    }

    return res.json({
      success: true,
      data: gymClass,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const updateClass = async (req, res) => {
  try {
    const gymClass = await Class.findById(req.params.id);

    if (!gymClass) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp",
      });
    }

    gymClass.name = req.body.name || gymClass.name;
    gymClass.ptId = req.body.ptId || gymClass.ptId;
    gymClass.schedule =
      req.body.schedule || gymClass.schedule;
    gymClass.maxSlots =
      req.body.maxSlots || gymClass.maxSlots;

    await gymClass.save();

    await logAction(
      req.user._id,
      "UPDATE_CLASS",
      gymClass._id
    );

    return res.json({
      success: true,
      data: gymClass,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const deleteClass = async (req, res) => {
  try {
    const gymClass = await Class.findById(req.params.id);

    if (!gymClass) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp",
      });
    }

    await gymClass.deleteOne();

    await logAction(
      req.user._id,
      "DELETE_CLASS",
      gymClass._id
    );

    return res.json({
      success: true,
      message: "Đã xoá lớp"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const joinClass = async (req, res) => {
  try {
    const gymClass = await Class.findById(req.params.id);

    if (!gymClass) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp học",
      });
    }

    const memberId = req.user._id;

    const joined = gymClass.members.some(
      (id) => id.toString() === memberId.toString()
    );

    if (joined) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đăng ký lớp này",
      });
    }

    if (gymClass.members.length >= gymClass.maxSlots) {
      gymClass.waitlist = gymClass.waitlist || [];

      const existed = gymClass.waitlist.find(
        (item) => item.memberId.toString() === memberId.toString()
      );

      if (existed) {
        return res.status(400).json({
          success: false,
          message: "Bạn đã nằm trong danh sách chờ",
        });
      }

      gymClass.waitlist.push({
        memberId,
        joinedAt: new Date(),
      });

      await gymClass.save();

      await logAction(
        req.user._id,
        "JOIN_WAITLIST",
        gymClass._id
      );

      return res.json({
        success: true,
        waitlist: true,
        message: "Lớp đã đầy. Bạn đã vào danh sách chờ.",
      });
    }

    gymClass.members.push(memberId);

    await gymClass.save();

    await logAction(
      req.user._id,
      "JOIN_CLASS",
      gymClass._id
    );

    return res.json({
      success: true,
      message: "Đăng ký lớp thành công",
      slotLeft: gymClass.maxSlots - gymClass.members.length,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const leaveClass = async (req, res) => {
  try {

    const gymClass = await Class.findById(req.params.id);

    if (!gymClass) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp",
      });
    }

    gymClass.members = gymClass.members.filter(
      (id) => id.toString() !== req.user._id.toString()
    );

    // ===== MOVE WAITLIST =====

    if (
      gymClass.waitlist &&
      gymClass.waitlist.length > 0 &&
      gymClass.members.length < gymClass.maxSlots
    ) {

      const first = gymClass.waitlist.shift();

      gymClass.members.push(first.memberId);

    }

    await gymClass.save();

    await logAction(
      req.user._id,
      "LEAVE_CLASS",
      gymClass._id
    );

    return res.json({
      success: true,
      message: "Đã hủy đăng ký",
      slotLeft: gymClass.maxSlots - gymClass.members.length,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const checkInClass = async (req, res) => {

  try {

    const gymClass = await Class.findById(req.params.id);

    if (!gymClass) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp",
      });
    }

    const joined = gymClass.members.some(
      (id) => id.toString() === req.user._id.toString()
    );

    if (!joined) {
      return res.status(400).json({
        success: false,
        message: "Bạn chưa đăng ký lớp",
      });
    }

    gymClass.checkedInCount =
      (gymClass.checkedInCount || 0) + 1;

    await gymClass.save();

    await logAction(
      req.user._id,
      "CHECKIN_CLASS",
      gymClass._id
    );

    return res.json({
      success: true,
      checkedIn: gymClass.checkedInCount,
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }

};

export const getWaitlist = async (req, res) => {

  try {

    const gymClass = await Class.findById(req.params.id)
      .populate("waitlist.memberId", "name avatar memberCode");

    if (!gymClass) {

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp",
      });

    }

    return res.json({
      success: true,
      count: gymClass.waitlist.length,
      data: gymClass.waitlist,
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }

};