// Packages
const mongoose = require('mongoose');

// Schema
const autoPublish = new mongoose.Schema({
	_id: String,
	autoPublish: { type: Boolean, default: true },
});

module.exports = mongoose.model('AutoPublish', autoPublish, 'autoPublish');
