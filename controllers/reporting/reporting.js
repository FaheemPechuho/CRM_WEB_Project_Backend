const mongoose = require("mongoose");
const EmailHistory = require("../../model/schema/email");
const User = require("../../model/schema/user");
const PhoneCall = require("../../model/schema/phoneCall");
const { Property } = require("../../model/schema/property");
const { Lead } = require("../../model/schema/lead");
const { Contact } = require("../../model/schema/contact");
const TextMsg = require("../../model/schema/textMsg");
const Task = require("../../model/schema/task");
const MeetingHistory = require("../../model/schema/meeting");
const email = require("../../model/schema/email");
const meeting = require("../../model/schema/meeting");

const index = async (req, res) => {
  const query = req.query;
  query.deleted = false;
  let result = await User.find(query);

  const today = new Date().toISOString();
  const dailyCounts = result?.map(async (user) => {
    const leads = await Lead.find({
      _id: user._id,
      createdDate: today,
    }).count();
    const emails = await EmailHistory.find({
      _id: user._id,
      createdDate: today,
    }).count();
    const calls = await PhoneCall.find({
      _id: user._id,
      createdDate: today,
    }).count();
    const properties = await Property.find({
      _id: user._id,
      createdDate: today,
    }).count();
    const contacts = await Contact.find({
      _id: user._id,
      createdDate: today,
    }).count();
    const tasks = await Task.find({
      _id: user._id,
      createdDate: today,
    }).count();

    return {
      ...user._doc,
      daily: { leads, emails, calls, properties, contacts, tasks },
    };
  });

  const results = await Promise.all(dailyCounts);
  res.json(results);
};

const lineChart = async (req, res) => {
  const query = req.query;
  query.deleted = false;
  const senderQuery = {};
  if (query.createdBy) {
    query.createdBy = new mongoose.Types.ObjectId(query.createdBy);
  }
  if (query.createBy) {
    senderQuery.sender = new mongoose.Types.ObjectId(query.createBy);
  }

  const user = await User.findById(req.user?.userId)
    .populate({
      path: "roles",
    })
    .exec();
  let lead = [];
  if (user?.roles[0]?.roleName === "Manager") {
    lead = await Lead.find({
      managerAssigned: user._id?.toString(),
      deleted: false,
      createBy: { $ne: null },
    }).countDocuments();
  } else if (user?.roles[0]?.roleName === "Agent") {
    lead = await Lead.find({
      agentAssigned: user._id?.toString(),
      deleted: false,
      createBy: { $ne: null },
    }).countDocuments();
  } else {
    lead = await Lead.find({
      deleted: false,
      createBy: { $ne: null },
    }).countDocuments();
  }

  const leadData = lead;

  let contact = await Contact.find({
    ...query,
    createBy: { $ne: null },
  }).countDocuments();
  const contactData = contact;

  let property = await Property.find({...query,       createBy: {$ne: null}
}).countDocuments() 
  const propertyData = property;  

  let task = await Task.find({...query,       createBy: {$ne: null}
}).countDocuments();
  const taskData = task;  

  let meetingHistory = await MeetingHistory.find({...query,       createBy: {$ne: null}
}).countDocuments() 
  const meetingHistoryData = meetingHistory;

  let email = await EmailHistory.find({...senderQuery,       sender: {$ne: null}
}).countDocuments(); 
  const emailData = email;

  let phoneCall = await PhoneCall.find({...senderQuery,       sender: {$ne: null}
}).countDocuments(); 
  const phoneCallData = phoneCall; 

  const result = [
    { name: "Lead", length: leadData, color: "red" },
    { name: "Contact", length: contactData, color: "blue" },
    { name: "Property", length: propertyData, color: "green" },
    { name: "Task", length: taskData, color: "pink" },
    { name: "Meeting", length: meetingHistoryData, color: "purple" },
    { name: "Email", length: emailData, color: "yellow" },
    { name: "Call", length: phoneCallData, color: "cyan" },
  ];

  res.send(result);
};

const data = async (req, res) => {
  try {
    // Set the start date and end date
    const startDateString = req.body.startDate;
    const endDateString = req.body.endDate;

    // Convert the startDateString and endDateString to Date objects
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

    // Ensure the dates are valid
    if (isNaN(startDate) || isNaN(endDate)) {
      return res
        .status(400)
        .json({ error: "Invalid date format. Please use YYYY-MM-DD." });
    }

    endDate.setHours(23, 59, 59, 999);

    let filter = req.body.filter;

    let matchFilter = {
      timestamp: { $gte: startDate, $lte: endDate }, // Filter documents with timestamp between startDate and endDate
    };
    // matchFilter.deleted = false;
    const query = req.query;
    // Convert sender to ObjectId if provided
    if (query.sender) {
      matchFilter.sender = new mongoose.Types.ObjectId(query.sender);
    }

    let groupFields = {
      year: { $year: "$timestamp" },
      month: { $month: "$timestamp" },
    };
    if (filter === "day") {
      groupFields.day = { $dayOfMonth: "$timestamp" };
    } else if (filter === "week") {
      groupFields.week = { $week: "$timestamp" };
    }

    let EmailDetails = await EmailHistory.aggregate([
      { $match: matchFilter },
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
      { $unwind: "$contact" },
      { $match: { "contact.deleted": false, "users.deleted": false } },
      {
        $group: {
          _id: groupFields,
          Emailcount: { $sum: 1 },
          id: { $first: "$_id" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": 1, "_id.day": -1 } },
      {
        $group: {
          _id: "$_id.week",
          emails: { $push: "$$ROOT" },
          totalEmails: { $sum: "$Emailcount" },
        },
      },
      {
        $project: {
          _id: 0,
          startDate: { $dateToString: { format: "%Y-%m-%d", date: startDate } },
          endDate: { $dateToString: { format: "%Y-%m-%d", date: endDate } },
          totalEmails: 1,
          Emails2: {
            $map: {
              input: "$emails",
              as: "email",
              in: {
                _id: "$$email.id",
                date: {
                  $dateToString: {
                    date: {
                      $dateFromParts: {
                        year: { $ifNull: ["$$email._id.year", "$_id.year"] },
                        month: { $ifNull: ["$$email._id.month", 1] },
                        day: { $ifNull: ["$$email._id.day", 1] },
                      },
                    },
                  },
                },
                Emailcount: "$$email.Emailcount",
              },
            },
          },
        },
      },
      { $unwind: "$Emails2" },
      {
        $group: {
          _id: {
            startDate: "$startDate",
            endDate: "$endDate",
            _id: "$Emails2._id",
          },
          date: { $first: "$Emails2.date" },
          Emailcount: { $first: "$Emails2.Emailcount" },
        },
      },
      {
        $project: {
          _id: 0,
          startDate: "$_id.startDate",
          endDate: "$_id.endDate",
          Emails: {
            _id: "$_id._id",
            date: "$date",
            Emailcount: "$Emailcount",
          },
        },
      },
      {
        $group: {
          _id: null,
          startDate: { $first: "$startDate" },
          endDate: { $first: "$endDate" },
          totalEmails: { $sum: "$Emails.Emailcount" },
          Emails: { $push: "$Emails" },
        },
      },
      { $unwind: "$Emails" }, // Unwind the "Emails" array to work on each element separately
      { $sort: { "Emails.date": 1 } }, // Sort the Emails array by the "date" field in ascending order
      {
        $group: {
          _id: "$_id",
          startDate: { $first: "$startDate" },
          endDate: { $first: "$endDate" },
          totalEmails: { $first: "$totalEmails" },
          Emails: { $push: "$Emails" },
        },
      },
      {
        $project: {
          _id: 0,
          startDate: 1,
          endDate: 1,
          totalEmails: 1,
          Emails: 1,
        },
      },
    ]);

    let outboundcall = await PhoneCall.aggregate([
      { $match: matchFilter },
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
      { $unwind: "$contact" },
      { $match: { "contact.deleted": false, "users.deleted": false } },
      {
        $group: {
          _id: groupFields,
          Callcount: { $sum: 1 },
          id: { $first: "$_id" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": 1, "_id.day": -1 } },
      {
        $group: {
          _id: "$_id.week",
          calls: { $push: "$$ROOT" },
          totalCall: { $sum: "$Callcount" },
        },
      },
      {
        $project: {
          _id: 0,
          startDate: { $dateToString: { format: "%Y-%m-%d", date: startDate } },
          endDate: { $dateToString: { format: "%Y-%m-%d", date: endDate } },
          totalCall: 1,
          result: {
            $map: {
              input: "$calls",
              as: "call",
              in: {
                _id: "$$call.id",
                date: {
                  $dateToString: {
                    date: {
                      $dateFromParts: {
                        year: { $ifNull: ["$$call._id.year", "$_id.year"] },
                        month: { $ifNull: ["$$call._id.month", 1] },
                        day: { $ifNull: ["$$call._id.day", 1] },
                      },
                    },
                  },
                },
                Callcount: "$$call.Callcount",
              },
            },
          },
        },
      },
      { $unwind: "$result" },
      {
        $group: {
          _id: {
            startDate: "$startDate",
            endDate: "$endDate",
            _id: "$result._id",
          },
          date: { $first: "$result.date" },
          Callcount: { $first: "$result.Callcount" },
        },
      },
      {
        $project: {
          _id: 0,
          startDate: "$_id.startDate",
          endDate: "$_id.endDate",
          Calls: {
            _id: "$_id._id",
            date: "$date",
            Callcount: "$Callcount",
          },
        },
      },
      {
        $group: {
          _id: null,
          startDate: { $first: "$startDate" },
          endDate: { $first: "$endDate" },
          totalCall: { $sum: "$Calls.Callcount" },
          Calls: { $push: "$Calls" },
        },
      },
      { $unwind: "$Calls" }, // Unwind the "Calls" array to work on each element separately
      { $sort: { "Calls.date": 1 } }, // Sort the Calls array by the "date" field in ascending order
      {
        $group: {
          _id: "$_id",
          startDate: { $first: "$startDate" },
          endDate: { $first: "$endDate" },
          totalCall: { $first: "$totalCall" },
          Calls: { $push: "$Calls" },
        },
      },
      {
        $project: { _id: 0, startDate: 1, endDate: 1, totalCall: 1, Calls: 1 },
      },
    ]);

    let TextSent = await TextMsg.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: "Contact",
          localField: "createFor",
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
      { $unwind: "$contact" },
      { $match: { "contact.deleted": false, "users.deleted": false } },
      {
        $group: {
          _id: groupFields,
          TextSentCount: { $sum: 1 },
          id: { $first: "$_id" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": 1, "_id.day": -1 } },
      {
        $group: {
          _id: "$_id.week",
          textMsgs: { $push: "$$ROOT" },
          totalTextSent: { $sum: "$TextSentCount" },
        },
      },
      {
        $project: {
          _id: 0,
          startDate: { $dateToString: { format: "%Y-%m-%d", date: startDate } },
          endDate: { $dateToString: { format: "%Y-%m-%d", date: endDate } },
          totalTextSent: 1,
          result: {
            $map: {
              input: "$textMsgs",
              as: "msg",
              in: {
                _id: "$$msg.id",
                date: {
                  $dateToString: {
                    date: {
                      $dateFromParts: {
                        year: { $ifNull: ["$$msg._id.year", "$_id.year"] },
                        month: { $ifNull: ["$$msg._id.month", 1] },
                        day: { $ifNull: ["$$msg._id.day", 1] },
                      },
                    },
                  },
                },
                TextSentCount: "$$msg.TextSentCount",
              },
            },
          },
        },
      },
      { $unwind: "$result" },
      {
        $group: {
          _id: {
            startDate: "$startDate",
            endDate: "$endDate",
            _id: "$result._id",
          },
          date: { $first: "$result.date" },
          TextSentCount: { $first: "$result.TextSentCount" },
        },
      },
      {
        $project: {
          _id: 0,
          startDate: "$_id.startDate",
          endDate: "$_id.endDate",
          TextMsges: {
            _id: "$_id._id",
            date: "$date",
            TextSentCount: "$TextSentCount",
          },
        },
      },
      {
        $group: {
          _id: null,
          startDate: { $first: "$startDate" },
          endDate: { $first: "$endDate" },
          totalTextSent: { $sum: "$TextMsges.TextSentCount" },
          TextMsges: { $push: "$TextMsges" },
        },
      },
      { $unwind: "$TextMsges" }, // Unwind the "TextMsges" array to work on each element separately
      { $sort: { "TextMsges.date": 1 } }, // Sort the TextMsges array by the "date" field in ascending order
      {
        $group: {
          _id: "$_id",
          startDate: { $first: "$startDate" },
          endDate: { $first: "$endDate" },
          totalTextSent: { $first: "$totalTextSent" },
          TextMsges: { $push: "$TextMsges" },
        },
      },
      {
        $project: {
          _id: 0,
          startDate: 1,
          endDate: 1,
          totalTextSent: 1,
          TextMsges: 1,
        },
      },
    ]);

    if (
      EmailDetails.length <= 0 &&
      outboundcall.length <= 0 &&
      TextSent.length <= 0
    ) {
      res.status(200).json({ totalEmails: 0, totalCall: 0, totalTextSent: 0 });
    } else {
      res.status(200).json({ EmailDetails, outboundcall });
      // res.status(200).json({ EmailDetails, outboundcall, TextSent });
    }
  } catch (err) {
    console.error("Failed :", err);
    res.status(400).json({ err, error: "Failed " });
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

const team = async (req, res) => {
  const agents = req.body.team;
  const dateTime = req.query?.dateTime?.split("|");
  const isDateTime = dateTime?.some((d) => d);

  const data = {
    Leads: 0,
    Contacts: 0,
    Tasks: 0,
    Properties: 0,
    Emails: 0,
    Calls: 0,
    Meetings: 0,
  };

  await Promise.all(
    agents?.map(async (user) => {
      const id = user?._id?.toString();
      if (id) {
        // Queries

        const senderQuery = { sender: user?._id?.toString(), deleted: false };

        const query = {
          createBy: user?._id?.toString(),
          deleted: false,
        };

        // DateTime range filter
        if (isDateTime && dateTime[0]) {
          const from = new Date(toUTC(dateTime[0]));
          query["createdDate"] = { $gte: from };
          senderQuery["timestamp"] = { $gte: from };
        }
        if (isDateTime && dateTime[1]) {
          const to = new Date(toUTC(dateTime[1]));
          query["createdDate"]["$lte"] = to;
          senderQuery["timestamp"]["$lte"] = to;
        }

        // Fetch data
        const contacts = await Contact.countDocuments(query);
        const tasks = await Task.countDocuments(query);
        const properties = await Property.countDocuments(query);
        const emails = await email.countDocuments(senderQuery);
        const calls = await PhoneCall.countDocuments(senderQuery);
        const meetings = await meeting.countDocuments(query);

        data["Contacts"] += contacts;
        data["Tasks"] += tasks;
        data["Emails"] += emails;
        data["Calls"] += calls;
        data["Meetings"] += meetings;
        data["Properties"] += properties;
      }
    })
  );

  const leadsQuery = {
    managerAssigned: req.body.managerID,
    deleted: false,
  };

  // DateTime range filter
  if (isDateTime && dateTime[0]) {
    const from = new Date(toUTC(dateTime[0]));
    leadsQuery["createdDate"] = { $gte: from };
  }
  if (isDateTime && dateTime[1]) {
    const to = new Date(toUTC(dateTime[1]));
    leadsQuery["createdDate"]["$lte"] = to;
  }

  const totalLeads = await Lead.find(leadsQuery).countDocuments();
  data["Leads"] = totalLeads;

  res.json(data);
};

module.exports = { index, lineChart, data, team };
