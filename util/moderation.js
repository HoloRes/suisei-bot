// Imports
// Packages
const moment = require('moment');
const { scheduleJob } = require('node-schedule');
const { MessageEmbed } = require('discord.js');
const humanizeDuration = require('humanize-duration');
const Sentry = require('@sentry/node');

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

Sentry.configureScope((scope) => {
	scope.setTag('module', 'Moderation');
});

// Info is a message that can be shown to the user, while the message can contain info for debugging
class ModerationError extends Error {
	constructor(message, info) {
		super();
		this.info = info || undefined;
	}
}

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
						userId: offender.id,
					});

					const embed = new MessageEmbed()
						.setTitle(`${logItem.type}${logItem._id ? ` | case ${logItem._id}` : ''}`)
						.setDescription(`**Offender:** ${offender.tag}${logItem.duration ? `\n**Duration:** ${logItem.duration}` : ''}\n**Reason:** ${logItem.reason}\n**Moderator:** ${moderator.tag}`)
						.setFooter(`ID: ${logItem.userId}`)
						.setColor(color)
						.setTimestamp();
					Setting.findById('modLogChannel', (err, doc) => {
						if (err) {
							Sentry.captureException(err);
							return logger.error(err, { labels: { module: 'moderation', event: ['log', 'databaseSearch'] } });
						}
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
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['updateMember', 'databaseSearch'] } });
			reject(err);
		} else if (!doc) {
			const user = new User({
				_id: member.id,
				lastKnownTag: member.user.tag,
			});
			user.save((err2) => {
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['updateMember', 'databaseSave'] } });
					reject(err2);
				} else resolve();
			});
		} else {
			// eslint-disable-next-line no-param-reassign
			doc.lastKnownTag = member.user.tag;
			doc.save((err2) => {
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['updateMember', 'databaseSave'] } });
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
		date: new Date(),
	});
	await logItem.save((err) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['warn', 'databaseSave'] } });
			reject(new ModerationError(err));
		}
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
			resolve({ info: 'failed to send DM' });
		});

	resolve({});
});

function unmute(member, reason, moderator) {
	return new Promise((resolve, reject) => {
		Setting.findById('mutedRole').lean().exec(async (err, setting) => {
			if (err) {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'moderation', event: ['unmute', 'databaseSearch'] } });
				reject(new ModerationError(err));
				return;
			}
			await member.fetch();
			if (!member.roles.cache.has(setting.value)) return reject(new ModerationError('', 'This member is not muted'));

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
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['unmute', 'databaseSearch'] } });
				}
				if (doc && doc.hardMute) {
					member.roles.add(doc.roles);
				}
				if (doc && plannedUnmutes[doc._id]) plannedUnmutes[doc._id].cancel();
			});
			resolve({});
		});
	});
}

exports.unmute = unmute;

function mute(member, duration, reason, moderator, tos) {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		const expirationDate = moment().add(duration, 'minutes');

		const logItem = new LogItem({
			userId: member.id,
			type: 'mute',
			reason,
			moderator: moderator.id,
			duration: humanizeDuration(moment.duration(duration, 'minutes').asMilliseconds(), { largest: 2, round: true }),
			date: new Date(),
		});
		await logItem.save((err) => {
			if (err) {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'moderation', event: ['mute', 'databaseSave'] } });
				reject(new ModerationError(err));
			}
			log(logItem, '#ff9c24');

			const strike = new Strike({
				_id: logItem._id,
				userId: member.id,
			});
			strike.save((err2) => {
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['mute', 'databaseSave'] } });
					reject(new ModerationError(err2));
				}
			});

			if (tos) {
				const tosStrike = new Strike({
					_id: -logItem._id,
					userId: member.id,
				});
				tosStrike.save((err2) => {
					if (err2) {
						Sentry.captureException(err2);
						logger.error(err2, { labels: { module: 'moderation', event: ['ban', 'databaseSave'] } });
						reject(new ModerationError(err2));
					}
				});
			}

			Mute.findOneAndDelete({ userId: member.id }, (err2, doc) => {
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['mute', 'databaseSearch'] } });
				}

				if (!err2 && doc) {
					try {
						plannedUnmutes[doc._id].cancel();
					} catch (err3) {
						Sentry.captureException(err3);
						logger.error(err3, { labels: { module: 'moderation', event: ['mute'] } });
					}
				}
			});

			const muteDoc = new Mute({
				_id: logItem._id,
				expireAt: expirationDate.toISOString(),
				userId: member.id,
			});
			muteDoc.save((err2) => {
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['warn', 'databaseSave'] } });
					reject(new ModerationError(err2));
				}
			});

			plannedUnmutes[logItem._id] = scheduleJob(expirationDate.toDate(), () => {
				unmute(member);
			});
		});

		await Setting.findById('mutedRole', async (err, setting) => {
			if (err) {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'moderation', event: ['mute', 'databaseSearch'] } });
				reject(new ModerationError(err));
			}

			if (!setting) reject(new ModerationError(err, 'Mute role not found.'));
			member.roles.add(setting.value, `Muted by ${moderator.user.tag} for ${humanizeDuration(moment.duration(duration, 'minutes').asMilliseconds())}`)
				.catch((err2) => {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['mute', 'discord'] } });
					reject(new ModerationError(err2));
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
				resolve({ info: 'failed to send DM' });
			});

		resolve({});
	});
}

exports.mute = mute;

exports.hardmute = (member, moderator) => new Promise((resolve, reject) => {
	Mute.findOne({ userId: member.id }, async (err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['hardmute', 'databaseSave'] } });
			reject(new ModerationError(err));
			return;
		}
		if (!doc) return reject(new ModerationError('', 'Member is not muted'));

		const mutedRole = await Setting.findById('mutedRole').exec()
			.catch((err2) => {
				Sentry.captureException(err2);
				logger.error(err2, { labels: { module: 'moderation', event: ['hardmute', 'databaseSearch'] } });
				reject(new ModerationError(err2));
			});

		// eslint-disable-next-line no-param-reassign
		doc.roles = await member.roles.cache.map((role) => role.id);
		const index = doc.roles.findIndex((role) => role === mutedRole.value);
		await doc.roles.splice(index, 1);
		// eslint-disable-next-line no-param-reassign
		doc.hardMute = true;

		await member.roles.remove(doc.roles);

		doc.save((err2) => {
			if (err2) {
				Sentry.captureException(err2);
				logger.error(err2, { labels: { module: 'moderation', event: ['hardmute', 'databaseSave'] } });
				reject(new ModerationError(err2));
			}
		});

		log({
			type: 'hardmute',
			userId: member.id,
			moderator: moderator.id,
			reason: 'N/A',
		}, '#ff9c24');
		resolve({});
	});
});

function kick(member, reason, moderator, tos) {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		const logItem = new LogItem({
			userId: member.id,
			type: 'kick',
			reason,
			moderator: moderator.id,
			date: new Date(),
		});
		await logItem.save((err) => {
			if (err) {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'moderation', event: ['kick', 'databaseSave'] } });
				reject(new ModerationError(err));
			}
			log(logItem, '#f54242');

			if (!tos) {
				const strike = new Strike({
					_id: logItem._id,
					userId: member.id,
				});
				strike.save((err2) => {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['kick', 'databaseSave'] } });
					reject(new ModerationError(err2));
				});
			}
		});
		if (!tos) {
			Mute.findOneAndDelete({ userId: member.id }, (err, doc) => {
				if (err) {
					Sentry.captureException(err);
					logger.error(err, { labels: { module: 'moderation', event: ['kick', 'databaseSearch'] } });
				}

				if (!err && doc) {
					try {
						plannedUnmutes[doc._id].cancel();
					} catch (e) {
						Sentry.captureException(err);
						logger.error(err, { labels: { module: 'moderation', event: ['kick', 'unmute'] } });
					}
				}
			});
		}

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
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'moderation', event: ['kick', 'discord'] } });
				reject(new ModerationError(err));
			});

		resolve({});
	});
}

exports.kick = kick;

function ban(member, reason, moderator, tos) {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		const logItem = new LogItem({
			userId: member.id,
			type: 'ban',
			reason,
			moderator: moderator.id,
			date: new Date(),
		});
		await logItem.save((err) => {
			if (err) {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'moderation', event: ['ban', 'databaseSave'] } });
				reject(new ModerationError(err));
			}
			log(logItem, '#f54242');

			const strike = new Strike({
				_id: logItem._id,
				userId: member.id,
			});
			strike.save((err2) => {
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['ban', 'databaseSave'] } });
					reject(new ModerationError(err2));
				}
			});

			if (tos) {
				const tosStrike = new Strike({
					_id: -logItem._id,
					userId: member.id,
				});
				tosStrike.save((err2) => {
					if (err2) {
						Sentry.captureException(err2);
						logger.error(err2, { labels: { module: 'moderation', event: ['ban', 'databaseSave'] } });
						reject(new ModerationError(err2));
					}
				});
			}
		});

		Mute.findOneAndDelete({ userId: member.id }, (err2, doc) => {
			if (err2) {
				Sentry.captureException(err2);
				logger.error(err2, { labels: { module: 'moderation', event: ['ban', 'databaseSearch'] } });
			}

			if (!err2 && doc) {
				try {
					plannedUnmutes[doc._id].cancel();
				} catch (err3) {
					logger.error(err3, { labels: { module: 'moderation', event: ['ban', 'databaseSearch'] } });
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
				resolve({ info: 'failed to send DM' });
			});

		await member.ban({ reason })
			.catch((err) => {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'moderation', event: ['ban', 'discord'] } });
				reject(new ModerationError(err));
			});

		resolve({});
	});
}

exports.ban = ban;

// This will automatically apply the next strike
exports.strike = (member, reason, moderator) => new Promise((resolve, reject) => {
	Strike.find({ userId: member.id }, (err, docs) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['strike', 'databaseSearch'] } });
			reject(new ModerationError(err));
			return;
		}
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

// eslint-disable-next-line no-async-promise-executor
exports.massban = (users, reason, moderator) => new Promise(async (resolve, reject) => {
	const timer = (ms) => new Promise((res) => setTimeout(res, ms));

	const guild = await client.guilds.fetch(config.discord.serverId)
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['massban', 'discord'] } });
			reject(new ModerationError(err));
		});

	for (let i = 0; i < users.length; i++) {
		// eslint-disable-next-line no-await-in-loop
		await guild.members.ban(users[i], { reason })
			.catch(() => {});
		// eslint-disable-next-line no-await-in-loop
		await timer(2000);
	}

	const embed = new MessageEmbed()
		.setTitle(`massban | ${users.length} users`)
		.setDescription(`**Reason:** ${reason}\n**Moderator:** ${moderator.user.tag}`)
		.setColor('#f54242')
		.setTimestamp();

	Setting.findById('modLogChannel', (err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['massban', 'databaseSearch'] } });
			return resolve({});
		}
		if (!doc) return resolve({});
		client.channels.fetch(doc.value)
			.then((channel) => {
				channel.send(embed);
			});
	});

	resolve({});
});

exports.tosviolation = (member, reason, moderator) => new Promise((resolve, reject) => {
	Strike.find({ userId: member.id }, (err2, strikes) => {
		if (err2) {
			Sentry.captureException(err2);
			logger.error(err2, { labels: { module: 'moderation', event: ['tosviolation', 'databaseSearch'] } });
			reject(new ModerationError(err2));
			return;
		}

		const activeStrikes = strikes.filter(
			(doc) => ((new Date() - doc.strikeDate) / (1000 * 3600 * 24)) <= 30,
		).length;

		if (activeStrikes > 0) {
			ban(member, reason, moderator, true)
				.then(resolve)
				.catch(reject);
		} else {
			mute(member, 7 * 24 * 60, reason, moderator, true)
				.then(() => {
					kick(member, reason, moderator, true)
						.then(resolve)
						.catch(reject);
				})
				.catch(reject);
		}
	});
});

exports.revoke = (caseID, reason, moderator) => new Promise((resolve, reject) => {
	Strike.findById(caseID, (err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['revoke', 'databaseSearch'] } });
			reject(new ModerationError(err));
			return;
		}

		if (!doc) reject(new ModerationError('', 'Strike not found'));
		else {
			Strike.findByIdAndDelete(caseID, (err2, strike) => {
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['revoke', 'databaseSearch'] } });
					reject(new ModerationError(err2));
					return;
				}

				log({
					_id: strike._id,
					userId: strike.userId,
					type: 'revoke',
					reason,
					moderator: moderator.id,
				}, '#2bad64');
				resolve({});
			});
		}
	});
});

exports.getMemberModLogs = (member) => new Promise((resolve, reject) => {
	LogItem.find({ userId: member.id }, (err, docs) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['getMemberModLogs', 'databaseSearch'] } });
			reject(new ModerationError(err));
			return;
		}

		Strike.find({ userId: member.id }, (err2, strikes) => {
			if (err2) {
				Sentry.captureException(err2);
				logger.error(err2, { labels: { module: 'moderation', event: ['getMemberModLogs', 'databaseSearch'] } });
				reject(new ModerationError(err2));
				return;
			}

			const activeStrikes = strikes.filter(
				(doc) => ((new Date() - doc.strikeDate) / (1000 * 3600 * 24)) <= 30,
			).length;

			resolve({
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
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['getModLogByCaseID', 'databaseSearch'] } });
			reject(new ModerationError(err));
			return;
		}

		if (!doc) return reject(new ModerationError(err, 'Moderation action not found'));

		resolve({ data: doc });
	});
});

exports.updateReason = (caseID, reason) => new Promise((resolve, reject) => {
	LogItem.findById(caseID, (err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['updateReason', 'databaseSearch'] } });
			reject(new ModerationError(err));
			return;
		}

		if (!doc) return reject(new ModerationError('', 'Moderation action not found'));

		// eslint-disable-next-line no-param-reassign
		doc.reason = reason;
		doc.save((err2) => {
			if (err2) {
				Sentry.captureException(err2);
				logger.error(err2, { labels: { module: 'moderation', event: ['updateReason', 'databaseSave'] } });
				reject(new ModerationError(err2));
			} else resolve({});
		});
	});
});

// eslint-disable-next-line no-async-promise-executor
exports.addNote = (member, note) => new Promise(async (resolve, reject) => {
	await updateMember(member);

	User.findById(member.id, (err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['addNote', 'databaseSearch'] } });
			reject(new ModerationError(err));
			return;
		}

		doc.notes.push({
			_id: doc.notes.length === 0 ? 1 : doc.notes[doc.notes.length - 1]._id + 1,
			value: note,
		});
		doc.save((err2) => {
			if (err2) {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'moderation', event: ['addNote', 'databaseSave'] } });
				reject(new ModerationError(err2));
			} else resolve({});
		});
	});
});

// eslint-disable-next-line no-async-promise-executor
exports.updateNote = (member, noteID, note) => new Promise(async (resolve, reject) => {
	await updateMember(member);

	User.findById(member.id, (err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['updateNote', 'databaseSearch'] } });
			reject(new ModerationError(err));
			return;
		}

		const index = doc.notes.findIndex((noteI) => noteI._id === noteID);
		if (index === -1) reject(new ModerationError('', 'Note not found'));
		else {
			// eslint-disable-next-line no-param-reassign
			doc.notes[index].value = note;
			doc.save((err2) => {
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['updateNote', 'databaseSave'] } });
					reject(new ModerationError(err2));
				} else resolve({});
			});
		}
	});
});

// eslint-disable-next-line no-async-promise-executor
exports.removeNote = (member, noteID) => new Promise(async (resolve, reject) => {
	await updateMember(member);

	User.findById(member.id, (err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['removeNote', 'databaseSearch'] } });
			reject(new ModerationError(err));
			return;
		}

		const index = doc.notes.findIndex((note) => note._id === noteID);
		if (index === -1) reject(new ModerationError('', 'Note not found'));
		else {
			doc.notes.splice(index, 1);
			doc.save((err2) => {
				if (err2) {
					Sentry.captureException(err2);
					logger.error(err2, { labels: { module: 'moderation', event: ['removeNote', 'databaseSave'] } });
					reject(new ModerationError(err2));
				} else resolve({});
			});
		}
	});
});

exports.getNotes = (member) => new Promise((resolve, reject) => {
	User.findById(member.id, (err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['getNotes', 'databaseSearch'] } });
			reject(new ModerationError(err));
			return;
		}

		if (!doc || !doc.notes) {
			updateMember(member);
			resolve({ data: [] });
		} else resolve({ data: doc.notes });
	});
});

// eslint-disable-next-line no-async-promise-executor
exports.getMemberFromMessage = (message, args) => new Promise(async (resolve, reject) => {
	if (message.mentions.members.size > 0) {
		const member = await message.mentions.members.first().fetch();
		if (member.hasPermission('MANAGE_GUILD')) reject(new ModerationError('', 'This member is a moderator'));
		else if (member.user.bot) reject(new ModerationError('', 'This user is a bot'));
		else resolve(member);
	} else {
		message.guild.members.fetch(args[0])
			.then((member) => {
				if (!member.user) reject(new ModerationError('', 'Member not found'));
				else if (member.hasPermission('MANAGE_GUILD')) reject(new ModerationError('', 'This member is a moderator'));
				else if (member.user.bot) reject(new ModerationError('', 'This user is a bot'));
				else resolve(member);
			})
			.catch(() => {
				message.guild.members.fetch()
					.then(() => {
						const member = message.guild.members.fetch({ query: args[0], limit: 1 })
							.catch(() => reject(new ModerationError('', 'Member not found')));

						if (!member.user) reject(new ModerationError('', 'Member not found'));

						else if (member.hasPermission('MANAGE_GUILD')) reject(new ModerationError('', 'This member is a moderator'));
						else if (member.user.bot) reject(new ModerationError('', 'This user is a bot'));
						else return resolve(member);
					});
			});
	}
});

scheduleJob('*/5 * * * *', async () => {
	const docs = await Mute.find({ expireAt: { $lte: new Date() } }).lean.exec()
		.catch((err) => {
			Sentry.captureException(err);
			return logger.error(err, { labels: { module: 'moderation', event: ['unmuteCron'] } });
		});

	docs.forEach(async (doc) => {
		if (doc.leftAt) return;
		const guild = await client.guilds.fetch(config.discord.serverId)
			.catch((err) => {
				Sentry.captureException(err);
				return logger.error(err, { labels: { module: 'moderation', event: ['unmuteCron', 'discord'] } });
			});

		const member = await guild.members.fetch(doc.userId)
			.catch((err) => {
				Sentry.captureException(err);
				return logger.error(err, { labels: { module: 'moderation', event: ['unmuteCron', 'discord'] } });
			});

		unmute(member)
			.catch((err) => {
				Sentry.captureException(err);
				return logger.error(err, { labels: { module: 'moderation', event: ['unmuteCron'] } });
			});
	});
});

exports.init = () => {
	Mute.find({}, (err, docs) => {
		if (err) return logger.error(err);
		docs.forEach(async (doc) => {
			if (doc.leftAt) return;
			const guild = await client.guilds.fetch(config.discord.serverId)
				.catch((err2) => {
					Sentry.captureException(err2);
					return logger.error(err2, { labels: { module: 'moderation', event: ['init', 'discord'] } });
				});

			const member = await guild.members.fetch(doc.userId)
				.catch((err2) => {
					Sentry.captureException(err2);
					return logger.error(err2, { labels: { module: 'moderation', event: ['init', 'discord'] } });
				});

			plannedUnmutes[doc._id] = scheduleJob(doc.expireAt, () => {
				unmute(member)
					.catch((err2) => {
						Sentry.captureException(err2);
						return logger.error(err2, { labels: { module: 'moderation', event: ['init'] } });
					});
			});
		});
	});
};

exports.unplanMute = (id) => {
	try {
		plannedUnmutes[id].cancel();
	} catch (err) {
		Sentry.captureException(err);
		return logger.error(err, { labels: { module: 'moderation', event: 'unplanMute' } });
	}
};
