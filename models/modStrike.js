// Packages
const mongoose = require("mongoose");

// Schema
const strikeSchema = new mongoose.Schema({
    _id: Number,
    userId: {type: String, required: true},
    strikeDate: {type: Date, default: new Date()}
});

module.exports = mongoose.model("Strike", strikeSchema, "strikes");