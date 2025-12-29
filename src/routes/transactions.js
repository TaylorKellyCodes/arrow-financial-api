const express = require("express");
const { requireAuth, requireRole, canEditCheckbox } = require("../middleware/auth");
const csrfProtection = require("../middleware/csrf");
const Transaction = require("../models/Transaction");
const { parseDateToUtc } = require("../utils/dateUtils");
const { logAudit } = require("../utils/auditLogger");
const { diffObjects } = require("../utils/diff");

const router = express.Router();

async function getNextSortOrder() {
  const last = await Transaction.findOne({}).sort({ sortOrder: -1 }).select("sortOrder");
  return last ? last.sortOrder + 1 : 1;
}

router.use(requireAuth);
router.use(csrfProtection);

router.get("/", async (req, res) => {
  const { transactionType, startDate, endDate, page = 1, limit = 100 } = req.query;
  const filter = {};
  if (transactionType) {
    filter.transactionType = transactionType;
  }
  if (startDate) {
    const parsed = parseDateToUtc(startDate);
    if (!parsed) return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid startDate" } });
    filter.date = { ...(filter.date || {}), $gte: parsed };
  }
  if (endDate) {
    const parsed = parseDateToUtc(endDate);
    if (!parsed) return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid endDate" } });
    filter.date = { ...(filter.date || {}), $lte: parsed };
  }
  const docs = await Transaction.find(filter)
    .sort({ sortOrder: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));
  return res.json({ transactions: docs });
});

router.post("/", requireRole(["admin", "taylor", "dad"]), async (req, res) => {
  const { date, transactionType, amount, notes } = req.body || {};
  const parsedDate = parseDateToUtc(date);
  if (!parsedDate) {
    return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid date format" } });
  }
  if (!transactionType || typeof amount !== "number") {
    return res.status(400).json({ error: { code: "VALIDATION", message: "Missing fields" } });
  }
  const sortOrder = await getNextSortOrder();
  const tx = await Transaction.create({
    date: parsedDate,
    transactionType,
    amount,
    notes,
    sortOrder
  });
  logAudit({
    userId: req.user.id,
    action: "create",
    transactionId: tx._id,
    timestamp: new Date(),
    after: tx.toObject()
  });
  return res.status(201).json({ transaction: tx });
});

router.put("/:id", requireRole(["admin", "taylor", "dad"]), async (req, res) => {
  const tx = await Transaction.findById(req.params.id);
  if (!tx) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Transaction not found" } });

  const updates = {};
  if (req.body.date) {
    const parsedDate = parseDateToUtc(req.body.date);
    if (!parsedDate) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid date format" } });
    }
    updates.date = parsedDate;
  }
  if (req.body.transactionType) updates.transactionType = req.body.transactionType;
  if (typeof req.body.amount === "number") updates.amount = req.body.amount;
  if (typeof req.body.notes === "string") updates.notes = req.body.notes;

  // Checkbox handling with field-level rule
  const checkboxFields = ["confirmationTaylor", "confirmationDad"];
  checkboxFields.forEach((field) => {
    if (field in req.body) {
      if (!canEditCheckbox(field, req.user.role)) {
        return;
      }
      updates[field] = Boolean(req.body[field]);
    }
  });

  // Guard against unauthorized checkbox edits
  if (
    ("confirmationTaylor" in req.body && !canEditCheckbox("confirmationTaylor", req.user.role)) ||
    ("confirmationDad" in req.body && !canEditCheckbox("confirmationDad", req.user.role))
  ) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cannot edit checkbox" } });
  }

  const before = tx.toObject();
  Object.assign(tx, updates);
  await tx.save();
  const after = tx.toObject();
  logAudit({
    userId: req.user.id,
    action: "update",
    transactionId: tx._id,
    timestamp: new Date(),
    before,
    after,
    diff: diffObjects(before, after)
  });
  return res.json({ transaction: tx });
});

router.patch("/:id/checkbox", requireRole(["admin", "taylor", "dad"]), async (req, res) => {
  const { field, value } = req.body || {};
  if (!["confirmationTaylor", "confirmationDad"].includes(field)) {
    return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid checkbox field" } });
  }
  if (!canEditCheckbox(field, req.user.role)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cannot edit checkbox" } });
  }
  const tx = await Transaction.findById(req.params.id);
  if (!tx) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Transaction not found" } });
  const before = tx.toObject();
  tx[field] = Boolean(value);
  await tx.save();
  const after = tx.toObject();
  logAudit({
    userId: req.user.id,
    action: "checkbox",
    transactionId: tx._id,
    timestamp: new Date(),
    before,
    after,
    diff: diffObjects(before, after)
  });
  return res.json({ transaction: tx });
});

router.delete("/:id", requireRole(["admin", "taylor", "dad"]), async (req, res) => {
  const tx = await Transaction.findById(req.params.id);
  if (!tx) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Transaction not found" } });
  const snapshot = tx.toObject();
  await tx.deleteOne();
  logAudit({
    userId: req.user.id,
    action: "delete",
    transactionId: snapshot._id,
    timestamp: new Date(),
    before: snapshot,
    after: null
  });
  return res.json({ success: true });
});

router.patch("/reorder", requireRole(["admin", "taylor", "dad"]), async (req, res) => {
  try {
    const { expectedOrder, orderedIds } = req.body || {};
    if (!Array.isArray(expectedOrder) || !Array.isArray(orderedIds)) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "expectedOrder and orderedIds required" } });
    }
    
    // Get all transactions sorted by current order
    const current = await Transaction.find({}).sort({ sortOrder: -1 }).select("_id sortOrder");
    const currentIds = current.map((c) => c._id.toString());
    
    // Verify we're reordering all transactions (no filters)
    if (expectedOrder.length !== currentIds.length) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Cannot reorder when filters are active. Please clear filters first." } });
    }
    
    // Verify expected order matches current order
    if (currentIds.join(",") !== expectedOrder.join(",")) {
      return res.status(409).json({ error: { code: "ORDER_CONFLICT", message: "Ordering changed", currentOrder: currentIds } });
    }
    
    // Validate orderedIds
    if (new Set(orderedIds).size !== orderedIds.length) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Duplicate ids in orderedIds" } });
    }
    
    if (orderedIds.length !== currentIds.length) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "orderedIds length mismatch" } });
    }
    
    // Verify all orderedIds exist
    const currentSet = new Set(currentIds);
    const allOrderedExist = orderedIds.every(id => currentSet.has(id));
    if (!allOrderedExist) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Some transactions in orderedIds don't exist" } });
    }
    
    // Assign sortOrder in reverse: first item in orderedIds gets highest sortOrder (appears at top)
    // We need to do this in two steps to avoid duplicate key errors:
    // 1. First, set all to temporary negative values to free up the range
    // 2. Then assign the final sortOrder values
    
    const totalItems = orderedIds.length;
    const tempOffset = 1000000; // Large offset to avoid conflicts
    
    // Step 1: Set all to temporary negative values
    const tempOps = orderedIds.map((id, idx) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder: -(tempOffset + idx) } }
      }
    }));
    
    await Transaction.bulkWrite(tempOps);
    
    // Step 2: Assign final sortOrder values
    const finalOps = orderedIds.map((id, idx) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder: totalItems - idx } }
      }
    }));
    
    await Transaction.bulkWrite(finalOps);
    
    logAudit({
      userId: req.user.id,
      action: "reorder",
      timestamp: new Date(),
      diff: { before: currentIds, after: orderedIds }
    });
    
    return res.json({ success: true, orderedIds });
  } catch (err) {
    console.error("Reorder error:", err);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message || "Failed to reorder transactions" } });
  }
});

router.get("/aggregations", async (req, res) => {
  const { by, startDate, endDate } = req.query;
  if (!["month", "category"].includes(by)) {
    return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid aggregation type" } });
  }
  const match = {};
  if (startDate) {
    const parsed = parseDateToUtc(startDate);
    if (!parsed) return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid startDate" } });
    match.date = { ...(match.date || {}), $gte: parsed };
  }
  if (endDate) {
    const parsed = parseDateToUtc(endDate);
    if (!parsed) return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid endDate" } });
    match.date = { ...(match.date || {}), $lte: parsed };
  }
  const pipeline = [{ $match: match }];
  if (by === "month") {
    pipeline.push({
      $group: {
        _id: { year: { $year: "$date" }, month: { $month: "$date" } },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 }
      }
    });
  } else if (by === "category") {
    pipeline.push({
      $group: {
        _id: "$transactionType",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 }
      }
    });
  }
  const results = await Transaction.aggregate(pipeline);
  return res.json({ results });
});

module.exports = router;

