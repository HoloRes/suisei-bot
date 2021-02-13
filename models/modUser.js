// Packages
const mongoose = require('mongoose');

// Schema
const userSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	notes: [{
		_id: Number,
		value: String,
	}],
	lastKnownTag: { type: String, required: true },
});

module.exports = mongoose.model('User', userSchema, 'modusers');
