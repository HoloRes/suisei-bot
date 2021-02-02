// Packages
const mongoose = require('mongoose');

// Schema
const pingSubscription = new mongoose.Schema({
	_id: String,
	users: [String],
	emoji: { type: String, required: true },
	messageID: { type: String, required: true },
	channelID: { type: String, required: true },
});

module.exports = mongoose.model('PingSubscription', pingSubscription, 'pingSubscriptions');
