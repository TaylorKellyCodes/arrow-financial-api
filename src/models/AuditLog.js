const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: {
      type: String,
      enum: ["login", "logout", "create", "update", "delete", "reorder", "checkbox"],
      required: true
    },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    timestamp: { type: Date, default: Date.now, index: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    diff: { type: Object },
    meta: { type: Object }
  },
  { minimize: false }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);

