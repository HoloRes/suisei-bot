const strikeSchema = new mongoose.Schema({
    _id: {type: Number},
    strikeDate: {type: Date, default: new Date()}
});

module.exports = mongoose.model("strike", strikeSchema, "strikes");