import Payment from "../models/Payment.js";
import Membership from "../models/Membership.js";
import CheckIn from "../models/CheckIn.js";
import User from "../models/User.js";
import Class from "../models/Class.js";
const getMonthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);

  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  return { start, end };
};

export const getOverview = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = getMonthRange(now);
    const lastMonth = getMonthRange(
      new Date(now.getFullYear(), now.getMonth() - 1, 1)
    );
    const totalMembers = await User.countDocuments({
      role: "member",
    });
    const newMembers = await User.countDocuments({
      role: "member",
      createdAt: {
        $gte: currentMonth.start,
        $lt: currentMonth.end,
      },
    });
    const next7 = new Date();
    next7.setDate(next7.getDate() + 7);
    const expiringSoon = await Membership.countDocuments({
      status: "active",
      endDate: {
        $gte: now,
        $lte: next7,
      },
    });

    const revenueCurrent = await Payment.aggregate([
      {
        $match: {
          status: {
            $in: ["PAID", "paid"],
          },
          createdAt: {
            $gte: currentMonth.start,
            $lt: currentMonth.end,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]);

    const revenueLast = await Payment.aggregate([
      {
        $match: {
          status: {
            $in: ["PAID", "paid"],
          },
          createdAt: {
            $gte: lastMonth.start,
            $lt: lastMonth.end,
          },
        },

      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]);

    const currentRevenue =
      revenueCurrent[0]?.total || 0;
    const lastRevenue =
      revenueLast[0]?.total || 0;
    let growth = 0;
    if (lastRevenue > 0) {
      growth =
        ((currentRevenue - lastRevenue) /
          lastRevenue) *
        100;

    }
    res.json({
      success: true,
      data: {
        totalMembers,
        newMembers,
        expiringSoon,
        currentRevenue,
        lastRevenue,
        growth: Number(growth.toFixed(2)),
      },
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getRevenueChart = async (req, res) => {
  try {
    const today = new Date();
    const sixMonthsAgo = new Date(
      today.getFullYear(),
      today.getMonth() - 5,
      1
    );

    const revenue = await Payment.aggregate([
      {
        $match: {
          status: {
            $in: ["PAID", "paid"],
          },
          createdAt: {
            $gte: sixMonthsAgo,
          },
        },
      },

      {
        $group: {
          _id: {
            year: {
              $year: "$createdAt",
            },
            month: {
              $month: "$createdAt",
            },
          },
          revenue: {
            $sum: "$amount",
          },
          orders: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },

    ]);
    res.json({
      success: true,
      data: revenue,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getCheckInHour = async (req, res) => {
  try {
    const data = await CheckIn.aggregate([
      {
        $match: {
          status: "success",
        },
      },
      {
        $group: {
          _id: {
            $hour: "$checkinTime",
          },
          total: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    const result = [];

    for (let i = 0; i < 24; i++) {
      const found = data.find((x) => x._id === i);

      result.push({
        hour: i,
        total: found ? found.total : 0,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getHeatmap = async (req, res) => {
  try {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const data = await CheckIn.aggregate([
      {
        $match: {
          status: "success",
          checkinTime: {
            $gte: start,
          },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dayOfWeek: "$checkinTime",
            },
            hour: {
              $hour: "$checkinTime",
            },
          },
          total: {
            $sum: 1,
          },
        },
      },
    ]);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getRenewalRate = async (req, res) => {
  try {
    const total = await Membership.countDocuments();

    const renewed = await Membership.countDocuments({
      status: "active",
      paymentId: {
        $ne: null,
      },
    });

    const rate =
      total === 0 ? 0 : Number(((renewed / total) * 100).toFixed(2));

    res.json({
      success: true,
      data: {
        total,
        renewed,
        rate,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getTopPT = async (req, res) => {
  try {
    const data = await Class.aggregate([
      {
        $project: {
          ptId: 1,
          members: 1,
          totalMember: {
            $size: "$members",
          },
          checkedInCount: 1,
        },
      },
      {
        $group: {
          _id: "$ptId",
          classes: {
            $sum: 1,
          },
          members: {
            $sum: "$totalMember",
          },
          checkins: {
            $sum: "$checkedInCount",
          },
        },
      },
      {
        $sort: {
          members: -1,
        },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "pt",
        },
      },
      {
        $unwind: "$pt",
      },
      {
        $project: {
          _id: 1,
          name: "$pt.name",
          avatar: "$pt.avatar",
          members: 1,
          classes: 1,
          checkins: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};