// Packages
const mongoose = require('mongoose');

// Local files
const { AutoIncrement } = require('$/index');

// Schema
const LogSchema = new mongoose.Schema({
	_id: Number,
	userId: { type: String, required: true },
	type: { type: String, required: true, enum: ['warn', 'mute', 'kick', 'ban'] },
	duration: { type: String },
	moderator: { type: String, required: true },
	reason: { type: String, required: true },
	date: { type: Date, default: Date.now() },
}, { _id: false });

LogSchema.plugin(AutoIncrement);

module.exports = mongoose.model('ModLogItem', LogSchema, 'modlog');
