// Packages
const mongoose = require('mongoose');

// Schema
const userSchema = new mongoose.Schema({
	_id: { type: Number, required: true },
	notes: [{
		type: String,
		id: Number,
	}],
	lastKnownTag: { type: String, required: true },
});

module.exports = mongoose.model('User', userSchema, 'modusers');
