const express = require("express");
const user = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

const TOKEN_TIMEOUT = 3600;


user.post("/register", async (req, res) => {
  try {
    let { email, firstname, lastname, age, password, role, panel } = req.body;

    if (!req.body || !email || !firstname || !lastname || !password) {
      return res.status(400).send("Missing required fields");
    }
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    if (age == null || undefined) {
      age = null;
    }
    if (!panel) {
      panel = 1;
    }
    if (role == null || role === undefined || Array.isArray(role)) {
      role = "user";
    } else {
      role = role.trim();
    }
    const checkRole = await prisma.role.findUnique({
      where: {
        name: role,
      },
    });

    const checkPanel = await prisma.panel.findUnique({
      where: {
        id: panel,
      },
    });

    if (!checkRole) {
      return res.status(404).send("Role not found");
    }
    const user = await prisma.user.create({
      data: {
        email: email,
        firstname: firstname,
        lastname: lastname,
        age: parseInt(age),
        password: hashed,
        role: {
          connect: {
            id: checkRole.id,
          },
        },
        id_panel: checkPanel.id,
      },
    });

    if (user) {
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      const mailOptions = {
        from: process.env.EMAIL,
        to: user.email,
        subject: "Account Verification",
        html: `<a href='http://localhost:3000/verification-compte/${token}'>Cliquer ici pour verifier votre compte</a>`,
      };
      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.log(err);
        } else {
          return res.status(200).json({ emailSent: true });
        }
      });
    }
  } catch (err) {
    if (err.code === "P2002") {
      return res
        .status(400)
        .json({ success: false, message: "Cet email est déjà utilisé." });
    }
    console.log(err);
    res.status(500).send("Internal Server Error ", err);
  }
});
user.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Account already validated" });
    }

    await prisma.user.update({
      where: { email: decoded.email },
      data: { verified: true },
    });

    res.status(200).json({ message: "Account verified successfully" });
  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).json({ message: "Invalid or expired token" });
  }
});
user.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Bad Request" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    if (!user.active || !user.verified) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User is inactive" });
    }

    const verify = await bcrypt.compare(password, user.password);
    if (!verify) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Incorrect password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: `${TOKEN_TIMEOUT}s` }
    );
    console.log("JWT Secret utilisé:", process.env.JWT_SECRET);
    console.log("Token généré:", token);
    res.status(200).json({
      message: "User Connected",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Forbidden: Invalid token" });
    }
    req.user = decoded;
    next();
  });
};


user.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        avatar: true,
        email: true,
        firstname: true,
        lastname: true,
        role: true,
      },
    });
    res.status(200).json(user);
  } catch (err) {
    console.error("Me Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


user.post("/logout", (req, res) => {
  res.status(200).json({ message: "Logged out successfully" });
});


user.post("/resend-email", async (req, res) => {

  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email: email },
  });
  if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
  if (user) {
    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: "Account Verification",
      html: `<a href='http://localhost:3000/verification-compte/${token}'>Cliquer ici pour verifier votre compte</a>`,
    };
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.log(err);
      } else {
        return res.status(200).json({ emailSent: true });
      }
    });
  }
})

module.exports = user;
