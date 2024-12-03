const mongoose = require("mongoose");

const DailyReport = new mongoose.Schema(
  {
    text: {
      type: String,
      default: "",
    },
    by: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("DailyReport", DailyReport, "DailyReport");
