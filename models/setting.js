// Packages
const mongoose = require('mongoose');

// Schema
const Setting = new mongoose.Schema({
	_id: String,
	value: mongoose.Mixed,
});

module.exports = mongoose.model('Setting', Setting, 'settings');
