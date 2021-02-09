// Imports
const express = require('express');

// Local imports
const { client } = require('$/index');
const config = require('$/config.json');
const moderation = require('$/util/moderation');

// Init
const router = new express.Router();

// Routes
router.get('/checkUser/:id', (req, res) => {
	client.guilds.fetch(config.discord.serverId)
		.then((guild) => {
			guild.members.fetch(req.params.id)
				.then((member) => {
					if (!member) return res.send('false');
					if (member.hasPermission('MANAGE_GUILD')) return res.send('true');
					return res.send('false');
				});
		});
});

// TODO: Remove eslint ignore line
// eslint-disable-next-line no-unused-vars
router.post('/modAction', (req, res) => {

});

// TODO: Add all request routes for dashboard logs

// Exports
module.exports = router;
