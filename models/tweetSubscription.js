// Packages
const mongoose = require("mongoose");

// Schema
const tweetSubscription = new mongoose.Schema({
    "_id": String,
    channels: [String]
});

module.exports = mongoose.model("tweetSubscription", tweetSubscription, "tweetSubscriptions");