// Packages
const mongoose = require("mongoose");

// Schema
const stream = new mongoose.Schema({
    "_id": String,
    "retry": { type: Number, default: 0 },
    "ytChannelID": String,
    "title": String,
    "plannedDate": String,
    "messageID": String
});

module.exports = mongoose.model("Livestream", stream, "livestreams");