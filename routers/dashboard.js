// Imports
const express = require('express');

// Models
const User = require('$/models/modUser');
const Strike = require('$/models/modStrike');
const ModLog = require('$/models/modLogItem');

// Local imports
const { client } = require('$/index');
const config = require('$/config.json');
const moderation = require('$/util/moderation');
const { logger } = require('$/index');

// Init
const router = new express.Router();
function authCheck(req, res, next) {
	if (req.get('Authorization') !== config.apiToken) return res.status(401).end();
	next();
}
router.use(authCheck);

async function getModData(req, res, next) {
	if (!req.body.moderator || !req.body.offender || !req.body.offenderId || !req.body.reason) {
		res.status(400).end();
	}
	const guild = await client.guilds.fetch(config.discord.serverId)
		.catch(() => res.status(500).end());
	req.data.guild = guild;

	req.data.moderator = await guild.members.fetch(req.body.moderator)
		.catch(() => res.status(404).send('Moderator not found'));

	req.data.offender = await guild.members.fetch(req.body.offender)
		.catch(() => res.status(404).end('Offender not found'));

	if (req.data.offender.hasPermission('MANAGE_GUILD') || req.data.offender.bot) return res.status(400).send("Can't take moderation action against this user");

	req.data.offenderId = req.body.offenderId;
	req.data.reason = req.body.reason;
	req.data.duration = req.body.duration || undefined;
	next();
}

// Routes
router.get('/checkUser/:id', async (req, res) => {
	if (!req.params.id) res.status(400).end();
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
	if (!req.data.duration) res.status(400).end();
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

router.post('/notes/:userid', async (req, res) => {
	const guild = await client.guilds.fetch(config.discord.serverId)
		.catch(() => res.status(500).end());

	const member = await guild.members.fetch(req.params.userid)
		.catch(() => res.status(404).send('Member not found'));

	if (member.hasPermission('MANAGE_GUILD') || member.user.bot) return res.status(400).send("Can't add notes to this user");

	moderation.addNote(member, req.body.note)
		.then((result) => res.status(201).json(result))
		.catch((err) => res.status(500).json(err));
});

router.delete('/notes/:userid/:noteid', async (req, res) => {
	const guild = await client.guilds.fetch(config.discord.serverId)
		.catch(() => res.status(500).end());

	const member = await guild.members.fetch(req.params.userid)
		.catch(() => res.status(404).send('Member not found'));

	if (member.hasPermission('MANAGE_GUILD') || member.user.bot) return res.status(400).send("Can't add notes to this user");

	moderation.removeNote(member, parseInt(req.params.noteid, 10))
		.then((result) => res.status(200).json(result))
		.catch((err) => {
			if (err.info) return res.status(400).json(err);
			res.status(500).json(err);
		});
});

router.get('/modlogs', async (req, res) => {
	const offset = parseInt(req.query.offset, 10) || 0;
	// eslint-disable-next-line no-nested-ternary
	const count = parseInt(req.query.count, 10) || 25;
	const options = req.query.userid ? { userId: req.query.userid } : {};

	if (req.query.userid) {
		const guild = await client.guilds.fetch(config.discord.serverId)
			.catch(() => res.status(500).end());

		const member = await guild.members.fetch(req.query.userid)
			.catch(() => res.status(404).send('Member not found'));

		if (member.hasPermission('MANAGE_GUILD') || member.user.bot) return res.status(400).send('No data for this member is available');
	}

	const logs = await ModLog.find(options).skip(offset).skip(offset).limit(count)
		.sort({ _id: 'desc' })
		.lean()
		.exec()
		.catch(() => res.status(500).end());

	// eslint-disable-next-line array-callback-return
	const promises = logs.map(async (log) => {
		const doc = await User.findById(log.userId).exec().catch(() => {});
		if (!doc) {
			const user = await client.users.fetch(log.userId)
				.catch(() => {});
			new User({
				_id: log.userId,
				lastKnownTag: user.tag,
			}).save();
			// eslint-disable-next-line no-param-reassign
			log.offender = user.tag;
			return log;
		}
		// eslint-disable-next-line no-param-reassign
		log.offender = doc.lastKnownTag;
		return log;
	});
	const modLogs = await Promise.all(promises);

	res.status(200).json(modLogs);
});

router.get('/userinfo/:userid', async (req, res) => {
	const guild = await client.guilds.fetch(config.discord.serverId)
		.catch(() => res.status(500).end());

	const member = await guild.members.fetch(req.params.userid)
		.catch(() => res.status(404).end('Member not found'));

	if (!member) return res.status(404).end();
	if (member.hasPermission('MANAGE_GUILD') || member.user.bot) return res.status(400).send('No data for this member is available');

	const strikes = await Strike.find({ userId: member.id }).exec()
		.catch(() => res.status(500).end());

	const activeStrikes = strikes.filter(
		(doc) => ((new Date() - doc.strikeDate) / (1000 * 3600 * 24)) <= 30,
	).length;

	User.findById(member.id, async (err, doc) => {
		if (err) res.status(500).end();
		if (!doc) {
			const user = new User({
				_id: member.id,
				notes: [],
				lastKnownTag: member.user.tag,
			});
			await user.save()
				.catch((err2) => { logger.error(err2); });

			return res.status(200).json({
				userData: user,
				member,
				activeStrikes,
				strikes: strikes.length,
			});
		}
		res.status(200).json({
			userData: doc,
			member,
			activeStrikes,
			strikes: strikes.length,
		});
	});
});

// Exports
module.exports = router;
