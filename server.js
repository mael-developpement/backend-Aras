const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const User = require("./middleware/User.js");
const Panel = require("./middleware/Panel.js");
const cors = require("cors");
require('dotenv').config();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/user", User);
app.use("/panel", Panel);
app.listen(process.env.PORT || 5000, () => {
  console.log("Server is running on port 5000");
});
