// Packages
const mongoose = require("mongoose");

// Schema
const muteSchema = new mongoose.Schema({
    _id: {type: Number},
    expireAt: {type: Date, required: true}
});

//muteSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Mute", muteSchema, "activeMutes");