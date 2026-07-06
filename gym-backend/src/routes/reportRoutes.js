import express from "express";
import {
  getOverview,
  getRevenueChart,
  getCheckInHour,
  getHeatmap,
  getRenewalRate,
  getTopPT,
  getForecast,
  getChurnRisk,
  exportExcelReport,
  exportPdfReport,
} from "../controllers/reportController.js";

import {
  protect,
  adminOrStaff,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/overview", protect, adminOrStaff, getOverview);

router.get("/revenue", protect, adminOrStaff, getRevenueChart);

router.get("/checkin-hour", protect, adminOrStaff, getCheckInHour);

router.get("/heatmap", protect, adminOrStaff, getHeatmap);

router.get("/renewal-rate", protect, adminOrStaff, getRenewalRate);

router.get("/top-pt", protect, adminOrStaff, getTopPT);

router.get("/forecast", protect, adminOrStaff, getForecast);

router.get("/churn-risk", protect, adminOrStaff, getChurnRisk);

router.get("/export/excel", protect, adminOrStaff, exportExcelReport);

router.get("/export/pdf", protect, adminOrStaff, exportPdfReport);

export default router;