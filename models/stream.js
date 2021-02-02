// Packages
const mongoose = require('mongoose');

// Schema
const stream = new mongoose.Schema({
	_id: String,
	retry: { type: Number, default: 0 },
	ytChannelID: { type: String, required: true },
	title: { type: String, required: true },
	plannedDate: { type: String, required: true },
	messageID: { type: String, required: true },
});

module.exports = mongoose.model('Livestream', stream, 'livestreams');
