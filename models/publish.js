// Packages
const mongoose = require("mongoose");

// Schema
const autoPublish = new mongoose.Schema({
    "_id": String,
    autoPublish: Boolean
});

module.exports = mongoose.model("autoPublish", autoPublish, "autoPublish");