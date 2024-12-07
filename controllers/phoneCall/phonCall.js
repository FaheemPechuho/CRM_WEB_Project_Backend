const { Lead } = require("../../model/schema/lead");
const PhoneCall = require("../../model/schema/phoneCall");
const User = require("../../model/schema/user");
const mongoose = require("mongoose");

const add = async (req, res) => {
  try {
    const {
      sender,
      recipient,
      callDuration,
      startDate,
      endDate,
      callNotes,
      createBy,
      createByLead,
    } = req.body;

    if (createBy && !mongoose.Types.ObjectId.isValid(createBy)) {
      res.status(400).json({ error: "Invalid createBy value" });
    }
    if (createByLead && !mongoose.Types.ObjectId.isValid(createByLead)) {
      res.status(400).json({ error: "Invalid createByLead value" });
    }
    const phoneCall = {
      sender,
      recipient,
      callDuration,
      startDate,
      endDate,
      callNotes,
    };

    if (createBy) {
      phoneCall.createBy = createBy;
    }

    if (createByLead) {
      phoneCall.createByLead = createByLead;
    }

    const user = await User.findById({ _id: phoneCall.sender });
    user.outboundcall = user.outboundcall + 1;
    await user.save();

    const result = new PhoneCall(phoneCall);
    await result.save();
    res.status(200).json({ result });
  } catch (err) {
    console.error("Failed to create :", err);
    res.status(400).json({ err, error: "Failed to create" });
  }
};

const history = async (req, res) => {
  try {
    const leadId = req.params?.lid;
    const role = req.query?.role;
    const lead = await Lead.findOne({ _id: leadId });

    const query = {
      createByLead: lead,
    };

    if (role === "user") {
      query["sender"] = req.user.userId;
    }

    const allCalls = await PhoneCall.find(query)
      .sort({ startDate: 1 })
      .populate({
        path: "sender",
      })
      .exec();

    res.json({
      lead: { createdAt: lead?.createdDate, createdBy: lead._doc.leadName },
      calls: allCalls,
    });
  } catch (err) {
    console.error("Failed to fetch :", err);
    res.status(400).json({ err, error: "Failed to fetch" });
  }
};

function toUTC(dateString) {
  const localDate = new Date(dateString);
  return new Date(
    Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours(),
      localDate.getMinutes(),
      localDate.getSeconds()
    )
  );
}

const index = async (req, res) => {
  try {
    const query = req.query;
    if (query.sender) {
      query.sender = new mongoose.Types.ObjectId(query.sender);
    }

    const dateTime = req.query?.dateTime?.split("|");
    const isDateTime = dateTime?.some((d) => d);

    let queryObj = {
      sender: query.sender,
    };
    let agentsArray = [];

    if (query?.role && query.role === "Manager") {
      agentsArray = query.agents.split(",")?.map((a) => new mongoose.Types.ObjectId(a));
      queryObj = {
        $or: [{ sender: query.sender }, { sender: { $in: agentsArray } }],
      };
    } else if (query?.role && query?.role === "superAdmin") {
      queryObj = {};
    }

    // DateTime range filter
    if (isDateTime && dateTime[0]) {
      const from = new Date(toUTC(dateTime[0]));
      queryObj["timestamp"] = { $gte: from };
    }
    if (isDateTime && dateTime[1]) {
      const to = new Date(toUTC(dateTime[1]));
      if (queryObj["timestamp"]) {
        queryObj["timestamp"]["$lte"] = to;
      }
    }

    let result = await PhoneCall.aggregate([
      { $match: queryObj },
      {
        $lookup: {
          from: "Lead", // Assuming this is the collection name for 'leads'
          localField: "createByLead",
          foreignField: "_id",
          as: "createByrefLead",
        },
      },
      {
        $lookup: {
          from: "Contact",
          localField: "createBy",
          foreignField: "_id",
          as: "contact",
        },
      },
      {
        $lookup: {
          from: "User",
          localField: "sender",
          foreignField: "_id",
          as: "users",
        },
      },
      { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },
      {
        $unwind: { path: "$createByrefLead", preserveNullAndEmptyArrays: true },
      },
      { $match: { "users.deleted": false } },
      {
        $addFields: {
          senderName: { $concat: ["$users.firstName", " ", "$users.lastName"] },
          deleted: {
            $cond: [
              { $eq: ["$contact.deleted", false] },
              "$contact.deleted",
              { $ifNull: ["$createByrefLead.deleted", false] },
            ],
          },
          createByName: {
            $cond: {
              if: "$contact",
              then: {
                $concat: [
                  "$contact.title",
                  " ",
                  "$contact.firstName",
                  " ",
                  "$contact.lastName",
                ],
              },
              else: { $concat: ["$createByrefLead.leadName"] },
            },
          },
        },
      },
      { $project: { contact: 0, createByrefLead: 0, users: 0 } },
    ]);

    res.status(200).json(result);
  } catch (err) {
    console.error("Failed :", err);
    res.status(400).json({ err, error: "Failed " });
  }
};

const view = async (req, res) => {
  try {
    let result = await PhoneCall.findOne({ _id: req.params.id });

    if (!result) return res.status(404).json({ message: "no Data Found." });

    let response = await PhoneCall.aggregate([
      { $match: { _id: result._id } },
      {
        $lookup: {
          from: "Contact",
          localField: "createBy",
          foreignField: "_id",
          as: "contact",
        },
      },
      {
        $lookup: {
          from: "Lead", // Assuming this is the collection name for 'leads'
          localField: "createByLead",
          foreignField: "_id",
          as: "createByrefLead",
        },
      },
      {
        $lookup: {
          from: "User",
          localField: "sender",
          foreignField: "_id",
          as: "users",
        },
      },
      { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },
      {
        $unwind: { path: "$createByrefLead", preserveNullAndEmptyArrays: true },
      },
      { $match: { "users.deleted": false } },
      {
        $addFields: {
          senderName: { $concat: ["$users.firstName", " ", "$users.lastName"] },
          deleted: {
            $cond: [
              { $eq: ["$contact.deleted", false] },
              "$contact.deleted",
              { $ifNull: ["$createByrefLead.deleted", false] },
            ],
          },
          createByName: {
            $cond: {
              if: "$contact",
              then: {
                $concat: [
                  "$contact.title",
                  " ",
                  "$contact.firstName",
                  " ",
                  "$contact.lastName",
                ],
              },
              else: { $concat: ["$createByrefLead.leadName"] },
            },
          },
        },
      },
      { $project: { contact: 0, createByrefLead: 0, users: 0 } },
    ]);

    res.status(200).json(response[0]);
  } catch (err) {
    console.error("Failed :", err);
    res.status(400).json({ err, error: "Failed " });
  }
};

module.exports = { add, index, view, history };
