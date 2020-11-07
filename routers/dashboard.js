// Imports
const express = require("express");

// Local imports
const {client} = require("$/index"),
    config = require("$/config.json");

// Init
const router = new express.Router();

// Routes
router.get("/checkUser/:id", (req, res) => {
    client.guilds.fetch(config.discord.serverId)
        .then((guild) => {
            guild.members.fetch(req.params.id)
                .then((member) => {
                    if(!member) return res.send("false");
                    if(member.hasPermission("MANAGE_GUILD")) return res.send("true");
                    else return res.send("false");
                })
        })
});

// Exports
module.exports = router;