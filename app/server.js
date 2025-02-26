const express = require("express");
const app = express();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();





app.use('/client', client)


const port = process.env.PORT;
console.log("port", port);