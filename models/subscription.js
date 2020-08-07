// Packages
const mongoose = require("mongoose");

// Schema
const Subscription = new mongoose.Schema({
    "_id": String,
    "channels": [[String]],
    message: String
});

module.exports = mongoose.model("Subscription", Subscription, "subscriptions");