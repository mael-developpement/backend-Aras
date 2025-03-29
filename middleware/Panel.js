const express = require("express");
const panel = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

panel.get('/pricing', async (req, res) => {
    const pricingdata = await prisma.panel.findMany();
    res.send(pricingdata);
});


module.exports = panel;
