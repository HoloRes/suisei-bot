// Packages
const mongoose = require("mongoose");

// Schema
const pingSubscription = new mongoose.Schema({
    "_id": String,
    "users": [String],
    "name": String,
    "emoji": String
});

module.exports = mongoose.model("PingSubscription", pingSubscription, "pingSubscriptions");