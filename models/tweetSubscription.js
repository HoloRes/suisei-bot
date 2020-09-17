// Packages
const mongoose = require("mongoose");

// Schema
const tweetSubscription = new mongoose.Schema({
    "_id": String,
    channelID: String
});

module.exports = mongoose.model("tweetSubscription", tweetSubscription, "tweetSubscriptions");