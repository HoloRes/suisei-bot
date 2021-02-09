// Imports
const express = require('express');

// Local imports
const { client } = require('$/index');
const config = require('$/config.json');
const moderation = require('$/util/moderation');

// Init
const router = new express.Router();
function authCheck(req, res, next) {
	if (req.get('Authorization') !== config.apiToken) return res.status(401).end();
	next();
}
router.use(authCheck);

async function getModData(req, res, next) {
	const guild = await client.guilds.fetch(config.discord.serverId)
		.catch(() => res.status(500).end());
	req.data.guild = guild;

	req.data.moderator = await guild.members.fetch(req.body.moderator)
		.catch(() => res.status(500).end());

	req.data.offender = await guild.members.fetch(req.body.offender)
		.catch(() => res.status(500).end());

	if (req.data.offender.hasPermission('MANAGE_GUILD') || req.data.offender.bot) res.status(400).send("Can't take moderation action against this user");

	req.data.offenderId = req.body.offenderId;
	req.data.reason = req.body.reason;
	req.data.duration = req.body.duration || undefined;
	next();
}

// Routes
router.get('/checkUser/:id', async (req, res) => {
	const guild = await client.guilds.fetch(config.discord.serverId)
		.catch(() => res.send('false'));

	const member = await guild.members.fetch(req.params.id)
		.catch(() => res.send('false'));

	if (!member) return res.send('false');
	if (member.hasPermission('MANAGE_GUILD')) return res.send('true');
	return res.send('false');
});

router.post('/modAction/strike', getModData, (req, res) => {
	moderation.strike(req.data.member, req.data.reason, req.data.moderator)
		.then((result) => {
			res.status(200).json(result);
		})
		.catch(() => {
			res.status(500).end();
		});
});

router.post('/modAction/warn', getModData, (req, res) => {
	moderation.warn(req.data.member, req.data.reason, req.data.moderator)
		.then((result) => {
			res.status(200).json(result);
		})
		.catch(() => {
			res.status(500).end();
		});
});

router.post('/modAction/mute', getModData, (req, res) => {
	moderation.mute(req.data.member, req.data.duration, req.data.reason, req.data.moderator)
		.then((result) => {
			res.status(200).json(result);
		})
		.catch(() => {
			res.status(500).end();
		});
});

router.post('/modAction/kick', getModData, (req, res) => {
	moderation.kick(req.data.member, req.data.reason, req.data.moderator)
		.then((result) => {
			res.status(200).json(result);
		})
		.catch(() => {
			res.status(500).end();
		});
});

router.post('/modAction/ban', getModData, (req, res) => {
	moderation.ban(req.data.member, req.data.reason, req.data.moderator)
		.then((result) => {
			res.status(200).json(result);
		})
		.catch(() => {
			res.status(500).end();
		});
});

// Exports
module.exports = router;
