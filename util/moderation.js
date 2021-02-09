// Imports
// Packages
const moment = require('moment');
const { scheduleJob } = require('node-schedule');
const { MessageEmbed } = require('discord.js');
const humanizeDuration = require('humanize-duration');

// Local files
const config = require('$/config.json');
const { client, logger, socket } = require('$/index');

// Models
const Mute = require('$/models/activeMute');
const LogItem = require('$/models/modLogItem');
const Strike = require('$/models/modStrike');
const User = require('$/models/modUser');
const Setting = require('$/models/setting');

// Init
const plannedUnmutes = {};

// Functions
function log(logItem, color) {
	client.users.fetch(logItem.userId)
		.then((offender) => {
			client.users.fetch(logItem.moderator)
				.then((moderator) => {
					socket.emit('log', {
						id: logItem._id || undefined,
						type: logItem.type,
						offender: offender.tag,
						duration: logItem.duration || undefined,
						reason: logItem.reason,
						moderator: moderator.tag,
						offenderId: offender.id,
					});

					const embed = new MessageEmbed()
						.setTitle(`${logItem.type}${logItem._id ? ` | case ${logItem._id}` : ''}`)
						.setDescription(`**Offender:** ${offender.tag}${logItem.duration ? `\n**Duration:** ${logItem.duration}` : ''}\n**Reason:** ${logItem.reason}\n**Moderator:** ${moderator.tag}`)
						.setFooter(`ID: ${logItem.userId}`)
						.setColor(color)
						.setTimestamp();
					Setting.findById('modLogChannel', (err, doc) => {
						if (err) return logger.error(err);
						if (!doc) return;
						client.channels.fetch(doc.value)
							.then((channel) => {
								channel.send(embed);
							});
					});
				});
		});
}

exports.log = log;

const updateMember = (member) => new Promise((resolve, reject) => {
	User.findById(member.id, (err, doc) => {
		if (err) {
			logger.error(err);
			reject(err);
		} else if (!doc) {
			const user = new User({
				_id: member.id,
				lastKnownTag: member.user.tag,
			});
			user.save((err2) => {
				if (err2) {
					logger.error(err2);
					reject(err2);
				} else resolve();
			});
		} else {
			// eslint-disable-next-line no-param-reassign
			doc.lastKnownTag = member.user.tag;
			doc.save((err2) => {
				if (err2) {
					logger.error(err2);
					reject(err2);
				} else resolve();
			});
		}
	});
});

// eslint-disable-next-line no-async-promise-executor
exports.warn = (member, reason, moderator) => new Promise(async (resolve, reject) => {
	const logItem = new LogItem({
		userId: member.id,
		type: 'warn',
		reason,
		moderator: moderator.id,
	});
	await logItem.save((err) => {
		// eslint-disable-next-line prefer-promise-reject-errors
		if (err) reject({ type: 'err', error: err });
		log(logItem, '#ffde26');
	});

	updateMember(member);

	const embed = new MessageEmbed()
		.setTitle('Warn')
		.setDescription(`You have been warned for: ${reason}\n\nNote: Warns do **NOT** count as strikes`)
		.setFooter(`Issued by: ${moderator.user.tag}`)
		.setTimestamp();

	await member.send(embed)
		.catch(() => {
			resolve({ type: 'success', info: 'failed to send DM' });
		});

	resolve({ type: 'success' });
});

function unmute(member, reason, moderator) {
	return new Promise((resolve, reject) => {
		Setting.findById('mutedRole').lean().exec((err, setting) => {
			// eslint-disable-next-line prefer-promise-reject-errors
			if (err) reject({ type: 'err', error: err });
			member.roles.remove(setting.value);
			if (reason && moderator) {
				log({
					userId: member.id,
					type: 'unmute',
					reason,
					moderator: moderator.id,
				}, '#2bad64');
			} else {
				log({
					userId: member.id,
					type: 'unmute',
					reason: 'Automatic unmute',
					moderator: client.user.id,
				}, '#2bad64');
			}
			Mute.findOneAndDelete({ userId: member.id }, (err2, doc) => {
				if (err2) logger.error(err2);
				if (doc && plannedUnmutes[doc._id]) plannedUnmutes[doc._id].cancel();
			});
			resolve({ type: 'success' });
		});
	});
}

exports.unmute = unmute;

function mute(member, duration, reason, moderator) {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		const expirationDate = moment().add(duration, 'minutes');

		const logItem = new LogItem({
			userId: member.id,
			type: 'mute',
			reason,
			moderator: moderator.id,
			duration: humanizeDuration(moment.duration(duration, 'minutes').asMilliseconds(), { largest: 2, round: true }),
		});
		await logItem.save((err) => {
			// eslint-disable-next-line prefer-promise-reject-errors
			if (err) reject({ type: 'err', error: err });
			log(logItem, '#ff9c24');

			const strike = new Strike({
				_id: logItem._id,
				userId: member.id,
			});
			strike.save((err2) => {
				// eslint-disable-next-line prefer-promise-reject-errors
				if (err2) reject({ type: 'err', error: err2 });
			});

			Mute.findOneAndDelete({ userId: member.id }, (err2, doc) => {
				if (err2) logger.error(err2);

				if (!err2 && doc) {
					try {
						plannedUnmutes[doc._id].cancel();
					} catch (e) {
						logger.error(e);
					}
				}
			});

			const muteDoc = new Mute({
				_id: logItem._id,
				expireAt: expirationDate.toISOString(),
				userId: member.id,
			});
			muteDoc.save((err2) => {
				// eslint-disable-next-line prefer-promise-reject-errors
				if (err2) reject({ type: 'err', error: err2 });
			});

			plannedUnmutes[logItem._id] = scheduleJob(expirationDate.toDate(), () => {
				unmute(member);
			});
		});

		await Setting.findById('mutedRole', async (err, setting) => {
			// eslint-disable-next-line prefer-promise-reject-errors
			if (err) reject({ type: 'err', error: err });
			// eslint-disable-next-line prefer-promise-reject-errors
			if (!setting) reject({ type: 'err', error: 'noRole' });
			member.roles.add(setting.value, `Muted by ${moderator.tag} for ${humanizeDuration(moment.duration(duration, 'minutes').asMilliseconds())}`)
				.catch((e) => {
					// eslint-disable-next-line prefer-promise-reject-errors
					reject({ type: 'err', error: e });
				});
		});

		updateMember(member);

		const embed = new MessageEmbed()
			.setTitle('Mute')
			.setDescription(`You have been muted for ${humanizeDuration(moment.duration(duration, 'minutes').asMilliseconds())}\nReason: ${reason}`)
			.setFooter(`Issued by: ${moderator.user.tag}`)
			.setTimestamp();

		await member.send(embed)
			.catch(() => {
				resolve({ type: 'success', info: 'failed to send DM' });
			});

		resolve({ type: 'success' });
	});
}

exports.mute = mute;

function kick(member, reason, moderator) {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		const logItem = new LogItem({
			userId: member.id,
			type: 'kick',
			reason,
			moderator: moderator.id,
		});
		await logItem.save((err) => {
			// eslint-disable-next-line prefer-promise-reject-errors
			if (err) reject({ type: 'err', error: err });
			log(logItem, '#f54242');

			const strike = new Strike({
				_id: logItem._id,
				userId: member.id,
			});
			strike.save((err2) => {
				// eslint-disable-next-line prefer-promise-reject-errors
				if (err) reject({ type: 'err', error: err2 });
			});
		});

		Mute.findOneAndDelete({ userId: member.id }, (err2, doc) => {
			if (err2) logger.error(err2);

			if (!err2 && doc) {
				try {
					plannedUnmutes[doc._id].cancel();
				} catch (e) {
					logger.error(e);
				}
			}
		});

		updateMember(member);

		const embed = new MessageEmbed()
			.setTitle('Kick')
			.setDescription(`You have been kicked for: ${reason}`)
			.setFooter(`Issued by: ${moderator.user.tag}`)
			.setTimestamp();

		await member.send(embed)
			.catch(() => {
				resolve({ type: 'success', info: 'failed to send DM' });
			});

		await member.kick(reason)
			.catch((err) => {
				// eslint-disable-next-line prefer-promise-reject-errors
				reject({ type: 'err', error: err });
			});

		resolve({ type: 'success' });
	});
}

exports.kick = kick;

function ban(member, reason, moderator) {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		const logItem = new LogItem({
			userId: member.id,
			type: 'ban',
			reason,
			moderator: moderator.id,
		});
		await logItem.save((err) => {
			// eslint-disable-next-line prefer-promise-reject-errors
			if (err) reject({ type: 'err', error: err });
			log(logItem, '#f54242');

			const strike = new Strike({
				_id: logItem._id,
				userId: member.id,
			});
			strike.save((err2) => {
				// eslint-disable-next-line prefer-promise-reject-errors
				if (err2) reject({ type: 'err', error: err2 });
			});
		});

		Mute.findOneAndDelete({ userId: member.id }, (err2, doc) => {
			if (err2) logger.error(err2);

			if (!err2 && doc) {
				try {
					plannedUnmutes[doc._id].cancel();
				} catch (e) {
					logger.error(e);
				}
			}
		});

		updateMember(member);

		const embed = new MessageEmbed()
			.setTitle('Ban')
			.setDescription(`You have been banned for: ${reason}`)
			.setFooter(`Issued by: ${moderator.user.tag}`)
			.setTimestamp();

		await member.send(embed)
			.catch(() => {
				resolve({ type: 'success', info: 'failed to send DM' });
			});

		await member.ban({ reason })
			.catch((err) => {
				// eslint-disable-next-line prefer-promise-reject-errors
				reject({ type: 'err', error: err });
			});

		resolve({ type: 'success' });
	});
}

exports.ban = ban;

// This will automatically apply the next strike
exports.strike = (member, reason, moderator) => new Promise((resolve, reject) => {
	Strike.find({ userId: member.id }, (err, docs) => {
		// eslint-disable-next-line prefer-promise-reject-errors
		if (err) reject({ type: 'err', error: err });
		if (docs.length === 0) {
			mute(member, 24 * 60, reason, moderator)
				.then(resolve)
				.catch(reject);
		} else {
			const activeStrikes = docs.filter(
				(doc) => ((new Date() - doc.strikeDate) / (1000 * 3600 * 24)) <= 30,
			).length;

			if (activeStrikes === 0) {
				mute(member, 24 * 60, reason, moderator)
					.then(resolve)
					.catch(reject);
			} else if (activeStrikes === 1) {
				mute(member, 7 * 24 * 60, reason, moderator)
					.then(resolve)
					.catch(reject);
			} else if (activeStrikes >= 2) {
				ban(member, reason, moderator)
					.then(resolve)
					.catch(reject);
			}
		}
	});
});

exports.revoke = (caseID, reason, moderator) => new Promise((resolve, reject) => {
	Strike.findById(caseID, (err, doc) => {
		// eslint-disable-next-line prefer-promise-reject-errors
		if (err) reject({ type: 'err', error: err });

		// eslint-disable-next-line prefer-promise-reject-errors
		if (!doc) reject({ type: 'err', info: 'Strike not found' });
		else {
			Strike.findByIdAndDelete(caseID, (err2, strike) => {
				// eslint-disable-next-line prefer-promise-reject-errors
				if (err2) reject({ type: 'err', error: err2 });

				log({
					_id: strike._id,
					userId: strike.userId,
					type: 'revoke',
					reason,
					moderator: moderator.id,
				}, '#2bad64');
				resolve({ type: 'success' });
			});
		}
	});
});

exports.getMemberModLogs = (member) => new Promise((resolve, reject) => {
	LogItem.find({ userId: member.id }, (err, docs) => {
		// eslint-disable-next-line prefer-promise-reject-errors
		if (err) reject({ type: 'err', error: err });

		Strike.find({ userId: member.id }, (err2, strikes) => {
			// eslint-disable-next-line prefer-promise-reject-errors
			if (err2) reject({ type: 'err', error: err2 });

			const activeStrikes = strikes.filter(
				(doc) => ((new Date() - doc.strikeDate) / (1000 * 3600 * 24)) <= 30,
			).length;

			resolve({
				type: 'success',
				data: {
					logs: docs,
					strikes: strikes.length,
					activeStrikes,
				},
			});
		});
	});
});

exports.getModLogByCaseID = (caseID) => new Promise((resolve, reject) => {
	LogItem.findById(caseID, (err, doc) => {
		// eslint-disable-next-line prefer-promise-reject-errors
		if (err) reject({ type: 'err', error: err });

		// eslint-disable-next-line prefer-promise-reject-errors
		if (err) reject({ type: 'err', info: 'Moderation action not found' });

		resolve({ type: 'success', data: doc });
	});
});

// eslint-disable-next-line no-async-promise-executor
exports.addNote = (member, note) => new Promise(async (resolve, reject) => {
	await updateMember(member);

	User.findById(member.id, (err, doc) => {
		// eslint-disable-next-line prefer-promise-reject-errors
		if (err) reject({ type: 'err', error: err });

		doc.notes.push({
			_id: doc.notes.length === 0 ? 1 : doc.notes[doc.notes.length - 1]._id + 1,
			value: note,
		});
		doc.save((err2) => {
			if (err2) {
				logger.error(err2);
				// eslint-disable-next-line prefer-promise-reject-errors
				reject({ type: 'err', error: err2 });
			} else resolve({ type: 'success' });
		});
	});
});

// eslint-disable-next-line no-async-promise-executor
exports.removeNote = (member, noteID) => new Promise(async (resolve, reject) => {
	await updateMember(member);

	User.findById(member.id, (err, doc) => {
		// eslint-disable-next-line prefer-promise-reject-errors
		if (err) reject({ type: 'err', error: err });

		const index = doc.notes.findIndex((note) => note._id === noteID);
		// eslint-disable-next-line prefer-promise-reject-errors
		if (index === -1) reject({ type: 'err', info: 'Note not found' });
		doc.notes.splice(index, 1);
		doc.save((err2) => {
			if (err2) {
				logger.error(err2);
				// eslint-disable-next-line prefer-promise-reject-errors
				reject({ type: 'err', error: err2 });
			} else resolve({ type: 'success' });
		});
	});
});

exports.getNotes = (member) => new Promise((resolve, reject) => {
	User.findById(member.id, (err, doc) => {
		// eslint-disable-next-line prefer-promise-reject-errors
		if (err) reject({ type: 'err', error: err });

		if (!doc || !doc.notes) {
			updateMember(member);
			// eslint-disable-next-line prefer-promise-reject-errors
			reject({ type: 'err', info: 'No user notes found' });
		} else resolve({ type: 'success', data: doc.notes });
	});
});

// eslint-disable-next-line no-async-promise-executor
exports.getMemberFromMessage = (message, args) => new Promise(async (resolve, reject) => {
	if (message.mentions.members.size > 0) {
		const member = await message.mentions.members.first().fetch();
		// eslint-disable-next-line prefer-promise-reject-errors
		if (member.hasPermission('MANAGE_GUILD')) reject('This member is a moderator');
		// eslint-disable-next-line prefer-promise-reject-errors
		else if (member.user.bot) reject('This user is a bot');
		else resolve(member);
	} else {
		message.guild.members.fetch(args[0])
			.then((member) => {
				// eslint-disable-next-line prefer-promise-reject-errors
				if (member.hasPermission('MANAGE_GUILD')) reject('This member is a moderator');
				// eslint-disable-next-line prefer-promise-reject-errors
				else if (member.user.bot) reject('This user is a bot');
				else resolve(member);
			})
			.catch(() => {
				message.guild.members.fetch()
					.then(() => {
						const member = message.guild.members.cache.find(
							(guildMember) => guildMember.user.tag.toLowerCase() === args[0].toLowerCase(),
						);
						// eslint-disable-next-line prefer-promise-reject-errors
						if (!member) reject('Member not found');

						// eslint-disable-next-line prefer-promise-reject-errors
						else if (member.hasPermission('MANAGE_GUILD')) reject('This member is a moderator');
						// eslint-disable-next-line prefer-promise-reject-errors
						else if (member.user.bot) reject('This user is a bot');
						else return resolve(member);
					});
			});
	}
});

exports.init = () => { // Should run on every bot start
	Mute.find({}, (err, docs) => {
		if (err) return logger.error(err);
		docs.forEach(async (doc) => {
			if (doc.leftAt) return;
			const guild = await client.guilds.fetch(config.discord.serverId)
				.catch((e) => logger.error(e));

			const member = await guild.members.fetch(doc.userId)
				.catch((e) => logger.error(e));

			plannedUnmutes[doc._id] = scheduleJob(doc.expireAt, () => {
				unmute(member)
					.catch((e) => logger.error(e));
			});
		});
	});
};

exports.unplanMute = (id) => {
	try {
		plannedUnmutes[id].cancel();
	} catch (e) {
		logger.error(e);
	}
};
