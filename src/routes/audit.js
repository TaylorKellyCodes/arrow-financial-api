const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const csrfProtection = require("../middleware/csrf");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(["admin"]));
router.use(csrfProtection);

router.get("/", async (req, res) => {
  const { userId, action, startDate, endDate, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (userId) filter.userId = userId;
  if (action) filter.action = action;
  if (startDate) filter.timestamp = { ...(filter.timestamp || {}), $gte: new Date(startDate) };
  if (endDate) filter.timestamp = { ...(filter.timestamp || {}), $lte: new Date(endDate) };
  const logs = await AuditLog.find(filter)
    .sort({ timestamp: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));
  return res.json({ logs });
});

module.exports = router;

