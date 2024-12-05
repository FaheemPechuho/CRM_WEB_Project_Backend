const User = require("../../model/schema/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Lead } = require("../../model/schema/lead");
const { Contact } = require("../../model/schema/contact");
const task = require("../../model/schema/task");
const { Property } = require("../../model/schema/property");
const email = require("../../model/schema/email");
const phoneCall = require("../../model/schema/phoneCall");
const meeting = require("../../model/schema/meeting");

// Admin register
const adminRegister = async (req, res) => {
  try {
    const { username, password, firstName, lastName, phoneNumber } = req.body;
    const user = await User.findOne({ username: username });
    if (user) {
      return res
        .status(400)
        .json({ message: "Admin already exist please try another email" });
    } else {
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      // Create a new user
      const user = new User({
        username,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
        role: "superAdmin",
      });
      // Save the user to the database
      await user.save();
      res.status(200).json({ message: "Admin created successfully" });
    }
  } catch (error) {
    res.status(500).json({ error: error });
  }
};

// User Registration
const register = async (req, res) => {
  try {
    const {
      username,
      password,
      firstName,
      lastName,
      phoneNumber,
      parent,
      role,
    } = req.body;
    const user = await User.findOne({ username: username });

    if (user) {
      return res
        .status(401)
        .json({ message: "user already exist please try another email" });
    } else {
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      // Create a new user
      const user = new User({
        username,
        password: hashedPassword,
        firstName,
        roles: [role],
        lastName,
        parent,
        phoneNumber,
        createdDate: new Date(),
      });
      // Save the user to the database
      await user.save();
      res.status(200).json({ message: "User created successfully" });
    }
  } catch (error) {
    res.status(500).json({ error });
  }
};

const index = async (req, res) => {
  try {
    const query = { ...req.query, deleted: false };

    let user = await User.find(query)
      .populate({
        path: "roles",
      })
      .exec();

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error });
  }
};

const view = async (req, res) => {
  try {
    let user = await User.findOne({ _id: req.params.id }).populate({
      path: "roles",
    });
    if (!user) return res.status(404).json({ message: "no Data Found." });
    res.status(200).json(user);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

let deleteData = async (req, res) => {
  try {
    const userId = req.params.id;

    // Assuming you have retrieved the user document using userId
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (user.role !== "superAdmin") {
      // Update the user's 'deleted' field to true
      await User.updateOne({ _id: userId }, { $set: { deleted: true } });
      res.send({ message: "Record deleted Successfully" });
    } else {
      res.status(404).json({ message: "admin can not delete" });
    }
  } catch (error) {
    res.status(500).json({ error });
  }
};

const deleteMany = async (req, res) => {
  try {
    const updatedUsers = await User.updateMany(
      { _id: { $in: req.body }, role: { $ne: "superAdmin" } },
      { $set: { deleted: true } }
    );
    res.status(200).json({ message: "done", updatedUsers });
  } catch (err) {
    res.status(404).json({ message: "error", err });
  }
};

const edit = async (req, res) => {
  try {
    let {
      username,
      firstName,
      target,
      lastName,
      phoneNumber,
      parent,
      password,
    } = req.body;

    if (password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updatedObj["password"] = hashedPassword;
    }

    let result = await User.updateOne(
      { _id: req.params.id },
      {
        $set: {
          username,
          firstName,
          lastName,
          phoneNumber,
          target,
          parent,
        },
      }
    );

    res.status(200).json(result);
  } catch (err) {
    console.error("Failed to Update User:", err);
    res.status(400).json({ error: "Failed to Update User" });
  }
};

const getTree = async (req, res) => {
  try {
    const allUsers = await User.find({ deleted: false }).populate({
      path: "roles",
    });

    const managers = allUsers.filter(
      (user) => user?.roles[0]?.roleName === "Manager"
    );
    const agents = {};

    managers.forEach((manager) => {
      const agentsForManager = allUsers?.filter(
        (user) => user?.parent?.toString() === manager?._id.toString()
      );
      agents[`manager-${manager?._id}`] = agentsForManager;
    });

    res.status(200).json({
      managers,
      agents,
    });
  } catch (error) {
    console.error("Failed to fetch Users tree:", error);
    res.status(400).json({ error: "Failed to Fetch Users tree" });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    // Find the user by username
    const user = await User.findOne({ username, deleted: false }).populate({
      path: "roles",
    });
    if (!user) {
      res
        .status(401)
        .json({ error: "Authentication failed, invalid username" });
      return;
    }
    // Compare the provided password with the hashed password stored in the database
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res
        .status(401)
        .json({ error: "Authentication failed,password does not match" });
      return;
    }
    // Create a JWT token
    const token = jwt.sign({ userId: user._id }, "secret_key", {
      expiresIn: "1d",
    });

    res
      .status(200)
      .setHeader("Authorization", `Bearer${token}`)
      .json({ token: token, user });
  } catch (error) {
    res.status(500).json({ error: "An error occurred" });
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

const fetchCounts = async (user, module, role, isDateTime, dateTime) => {
  let length = 0;
  const managerQuery = {
    agentAssigned: user?._id?.toString(),
    deleted: false,
  };
  const agentQuery = {
    managerAssigned: user?._id?.toString(),
    deleted: false,
  };

  const otherQuery = { createBy: user?._id?.toString(), deleted: false };
  const senderQuery = { sender: user?._id?.toString(), deleted: false };

  // DateTime range filter
  if (isDateTime && dateTime[0]) {
    const from = new Date(toUTC(dateTime[0]));
    managerQuery["createdDate"] = { $gte: from };
    agentQuery["createdDate"] = { $gte: from };
    otherQuery["createdDate"] = { $gte: from };
    senderQuery["timestamp"] = { $gte: from };
  }
  if (isDateTime && dateTime[1]) {
    const to = new Date(toUTC(dateTime[1]));
    managerQuery["createdDate"]["$lte"] = to;
    agentQuery["createdDate"]["$lte"] = to;
    otherQuery["createdDate"]["$lte"] = to;
    senderQuery["timestamp"]["$lte"] = to;
  }

  if (module === "Leads") {
    let response = 0;

    if (role === "Manager") {
      response = await Lead.find(managerQuery)?.count();
    } else {
      response = await Lead.find(agentQuery)?.count();
    }
    length = response;
  } else if (module === "Contacts") {
    const response = await Contact.find(otherQuery)?.count();
    length = response;
  } else if (module === "Tasks") {
    const response = await task.find(otherQuery)?.count();
    length = response;
  } else if (module === "Properties") {
    const response = await Property.find(otherQuery)?.count();
    length = response;
  } else if (module === "Emails") {
    const response = await email.find(senderQuery)?.count();
    length = response;
  } else if (module === "Calls") {
    const response = await phoneCall.find(senderQuery)?.count();
    length = response;
  } else if (module === "Meetings") {
    const response = await meeting.find(otherQuery)?.count();
    length = response;
  }

  return {
    name: user?.firstName + " " + user?.lastName,
    length,
  };
};

const getUsersView = async (req, res) => {
  try {
    const role = req.query?.role;
    const module = req.query?.module;
    const body = req.body;
    const dateTime = req.query?.dateTime?.split("|");
    const isDateTime = dateTime?.some((d) => d);

    const response = await Promise.all(
      body?.map(async (user) => {
        const data = await fetchCounts(
          user,
          module,
          role,
          isDateTime,
          dateTime
        );
        return data;
      })
    );

    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ error: "Failed to fetch users view" });
  }
};

const autoAssign = async (req, res) => {
  const agents = req.body.agents;

  const unnassignedLeads = await Lead.find({
    deleted: false,
    managerAssigned: req.user.userId,
    agentAssigned: { $in: ["", null] },
  }).sort({ createdDate: -1 });

  const allUnassLeads = [...unnassignedLeads];

  const leadsPerAgent = parseInt(allUnassLeads.length / agents.length);

  await Promise.all(
    agents?.map(async (agent) => {
      if (allUnassLeads.length) {
        const leadsForAgent = allUnassLeads.slice(0, leadsPerAgent);
        const leadIds =
          leadsForAgent?.map((lead) => lead?._id?.toString()) || [];

        allUnassLeads.splice(0, leadsPerAgent);

        // console.log(agent?.firstName + "--" + leadsForAgent[0]);
        return Lead.updateMany(
          { _id: { $in: leadIds } },
          { $set: { agentAssigned: agent?._id?.toString() } }
        );
      } else {
        return 0;
      }
    })
  );

  res.json({
    status: true,
    message: "Auto assigned the leads to agents",
  });

  try {
  } catch (error) {
    res.status(400).json({ error: "Failed to auto-assign" });
  }
};

const changeRoles = async (req, res) => {
  try {
    const userId = req.params.id;

    let result = await User.updateOne(
      { _id: userId },
      { $set: { roles: req.body } }
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Failed to Change Role:", error);
    res.status(400).json({ error: "Failed to Change Role" });
  }
};

module.exports = {
  register,
  login,
  adminRegister,
  getTree,
  index,
  deleteMany,
  view,
  deleteData,
  getUsersView,
  edit,
  changeRoles,
  autoAssign,
};
