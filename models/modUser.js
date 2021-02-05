// Packages
const mongoose = require('mongoose');

// Schema
const userSchema = new mongoose.Schema({
	_id: { type: Number, required: true },
	notes: [{
		_id: Number,
		value: String,
	}],
	lastKnownTag: { type: String, required: true },
});

module.exports = mongoose.model('User', userSchema, 'modusers');
