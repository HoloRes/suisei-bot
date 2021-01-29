// Packages
const mongoose = require("mongoose");

// Schema
const pingSubscription = new mongoose.Schema({
    _id: String,
    users: [String],
    emoji: String,
    messageID: String,
    channelID: String
});

module.exports = mongoose.model("PingSubscription", pingSubscription, "pingSubscriptions");