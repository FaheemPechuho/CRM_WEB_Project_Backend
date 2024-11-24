const mongoose = require('mongoose');
const User = require('../model/schema/user');
const bcrypt = require('bcrypt');
const { initializeLeadSchema } = require("../model/schema/lead");
const { initializeContactSchema } = require("../model/schema/contact");
const { initializePropertySchema } = require("../model/schema/property");
const cron = require("node-cron");

const initializedSchemas = async () => {
    await initializeLeadSchema();
    await initializeContactSchema();
    await initializePropertySchema();
}

const connectDB = async (DATABASE_URL, DATABASE, handleFollowupReminders) => {
    try {
        const DB_OPTIONS = {
            dbName: DATABASE
        }

        mongoose.set("strictQuery", false);
        await mongoose.connect(DATABASE_URL, DB_OPTIONS);

        await initializedSchemas();

        let adminExisting = await User.find({ role: 'superAdmin', username: "admin@gmail.com" });
        if (adminExisting.length <= 0) {
            const phoneNumber = 7874263694
            const firstName = 'Admin'
            const lastName = 'Account'
            const username = 'admin@gmail.com'
            const password = 'admin123'
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
            // Create a new user
            const user = new User({ _id: new mongoose.Types.ObjectId('64d33173fd7ff3fa0924a109'), username, password: hashedPassword, firstName, lastName, phoneNumber, role: 'superAdmin' });
            // Save the user to the database
            await user.save();
            console.log("Admin created successfully..");
        } else if (adminExisting[0].deleted === true) {
            await User.findByIdAndUpdate(adminExisting[0]._id, { deleted: false });
            console.log("Admin Update successfully..");
        } else if (adminExisting.username !== "admin@gmail.com") {
            await User.findByIdAndUpdate(adminExisting[0]._id, { username: 'admin@gmail.com' });
            console.log("Admin Update successfully..");
        }

        console.log("Database Connected Successfully..");

        cron.schedule("* * * * *", () => {
        handleFollowupReminders();
        });
    } catch (err) {
        console.log("Database Not connected", err.message);
    }
}
module.exports = connectDB