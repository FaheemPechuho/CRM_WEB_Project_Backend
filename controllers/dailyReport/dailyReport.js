const DailyReport = require("../../model/schema/dailyReport");

const mongoose = require("mongoose");

const index = async (req, res) => {
  try {
    const query = {};
    const role = req.query?.role;

    if (role === "Manager") {
      query["by"] = req.user.userId;
    }

    const dailyReports = await DailyReport.find(query)
      .populate({
        path: "by",
      })
      .exec();

    res.json({
      status: true,
      data: dailyReports,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

const all = async (req, res) => {
  try {
    const managersList = req.body?.managers;

    const allDailyReports = await Promise.all(
      managersList?.map(async (manager) => {
        const data = await DailyReport.find({ by: manager?._id?.toString() });
        return {
          reports: data,
          userName: manager?.firstName + manager?.lastName,
        };
      })
    );

    res.json({
      status: true,
      data: allDailyReports,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

const add = async (req, res) => {
  try {
    const { text } = req.body;
    const result = new DailyReport({ text, by: req.user.userId });
    await result.save();
    res.status(200).json(result);
  } catch (err) {
    console.error("Failed to create task:", err);
    res.status(400).json({ error: "Failed to create task : ", err });
  }
};

module.exports = { index, add, all };
