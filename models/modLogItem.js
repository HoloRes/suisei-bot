const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema({
    _id: {type: String, required: true},
    seq: {type: Number, default: 0}
});

const counter = mongoose.model("counter", CounterSchema, "counters");

const LogSchema = new mongoose.Schema({
    _id: {type: Number},
    userID: {type: String, required: true},
    lastKnownTag: {type: String, required: true},
    type: {type: String, required: true, enum: ["warn", "mute", "kick", "ban"]},
    duration: {type: String, required: true},
    moderator: {type: String, required: true}
});

LogSchema.pre("save", (next) => {
    const doc = this;
    counter.findByIdAndUpdate({_id: "moderation"}, {$inc: {seq:1}}, {new:true, upsert:true})
        .then((count) => {
            doc._id = count;
            next();
        });
});

module.exports = mongoose.model("modLogItem", LogSchema, "modlog")