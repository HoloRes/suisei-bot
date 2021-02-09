// Packages
const mongoose = require('mongoose');

// Schema
const stream = new mongoose.Schema({
	_id: String,
	title: { type: String, required: true },
	messageId: { type: String, required: true },
});

module.exports = mongoose.model('Livestream', stream, 'livestreams');
