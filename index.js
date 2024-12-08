const express = require("express");
const db = require("./db/config");
const route = require("./controllers/route");
const bodyParser = require("body-parser");
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const Task = require("./model/schema/task");

//Setup Express App
const app = express();
const serve = http.createServer(app);

// Middleware
app.use(bodyParser.json());
// Set up CORS
app.use(cors());
// Set up web socket
const io = require("socket.io")(serve, {
  cors: {
    origin: "*",
  },
});
//API Routes
app.use("/api", route);

app.get("/", async (req, res) => {
  res.send("Welcome to my world...");
});

// Sockets

let connected_users = [];

io.on("connection", (socket) => {
  socket.on("add_user", ({userID, userName}) => {
    if (!connected_users.find((user) => user._id === userID)) {
      connected_users.push({
        _id: userID,
        username: userName,
        socketID: socket?.id,
      });
      console.log("user connected: ", userName); 
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected: ", connected_users.find((u) => u.socketID === socket?.id)?.username); 
    connected_users = connected_users.filter(
      (user) => user?.socketID !== socket?.id
    );
  });
});

// Cron job
async function handleFollowupReminders() {
  const ids = connected_users.map((user) => user._id);

  const currentMinute = new Date();

  const now2 = new Date(); 
  const nextMinute = now2.setMinutes(now2.getMinutes() + 1);

  const tasks = await Task.find({
    createBy: { $in: ids },
    start: {$gte: currentMinute, $lte: nextMinute},
    title: "followup"
  });


  tasks.forEach((task) => {
    const socketID = connected_users.find(user => user._id.toString() === task.createBy.toString())?.socketID;  
    if(socketID) {
      io.to(socketID).emit("followup_reminder", task); 
    }
  })

}


// Get port from environment and store in Express.

const server = serve.listen(port, () => {
  const protocol =
    process.env.HTTPS === "true" || process.env.NODE_ENV === "production"
      ? "https"
      : "http";
  const { address, port } = server.address();
  const host = address === "::" ? "127.0.0.1" : address;
  console.log(`Server listening at ${protocol}://${host}:${port}`);
});

// Connect to MongoDB
const DATABASE_URL = process.env.DB_URL || "mongodb://127.0.0.1:27017";
const DATABASE = process.env.DB || "crm";

db(DATABASE_URL, DATABASE, handleFollowupReminders);
