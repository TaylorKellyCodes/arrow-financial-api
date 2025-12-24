const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    transactionType: {
      type: String,
      enum: ["Durham Truck", "Concord Truck", "Deposit", "Credit Card Charge"],
      required: true
    },
    amount: { type: Number, required: true },
    notes: { type: String },
    confirmationTaylor: { type: Boolean, default: false },
    confirmationDad: { type: Boolean, default: false },
    sortOrder: { type: Number, required: true, unique: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);

