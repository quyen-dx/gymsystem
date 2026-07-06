import express from "express";

import {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
  joinClass,
  leaveClass,
  checkInClass,
  getWaitlist,
} from "../controllers/groupClassController.js";

import {
  protect,
  adminOrPT,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", protect, adminOrPT, createClass);

router.get("/", protect, getClasses);

router.get("/:id", protect, getClassById);

router.put("/:id", protect, adminOrPT, updateClass);

router.delete("/:id", protect, adminOrPT, deleteClass);

router.post("/:id/join", protect, joinClass);

router.post("/:id/leave", protect, leaveClass);

router.post("/:id/checkin", protect, checkInClass);

router.get("/:id/waitlist", protect, adminOrPT, getWaitlist);

export default router;