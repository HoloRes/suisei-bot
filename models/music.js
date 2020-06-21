// Packages
const mongoose = require("mongoose");

// Schema
const Music = new mongoose.Schema({
    "author": Number,
    "_id": String
});

module.exports = mongoose.model("Music", Music);