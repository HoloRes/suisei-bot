// Packages
const mongoose = require("mongoose"),
    shortid = require("shortid");

// Schema
const Music = new mongoose.Schema({
    "author": Number,
    "_id": {
        "type": String,
        "default": shortid.generate
    },
    "title": String,
    "authorName": String
});

module.exports = mongoose.model("Music", Music);