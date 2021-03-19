// Packages
const mongoose = require('mongoose');

// Schema
const Setting = new mongoose.Schema({
	_id: String,
	value: { type: mongoose.Mixed, required: true },
});

module.exports = mongoose.model('Setting', Setting, 'settings');
