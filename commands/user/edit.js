// Schemas
const Music = require("$/models/music");

// Modules
const fs = require("fs"),
    NodeID3 = require("node-id3"),
    util = require("util"),
    Discord = require("discord.js");

exports.run = (client, message, args) => {
    /*
    TODO:
    1. Get ID and check against DB
    2. Check if owner or staff, in case of staff and not owner: give confirmation embed
    3. Ask what entry to edit (owner, author name or title) in embed
    4. Ask the value, if owner: ping or id
    5. Confirmation embed including the new value
    6. Save/cancel changes
    */
}

module.exports.config = {
    command: "edit"
}
