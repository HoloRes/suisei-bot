// Packages
import moment from 'moment';
import { scheduleJob } from 'node-schedule';
import humanizeDuration from 'humanize-duration';
import Sentry from '@sentry/node';
import Discord, { MessageEmbed } from 'discord.js';
import winston from 'winston';

// Models
import ActiveMute, { IActiveMute } from '../models/ActiveMute';
import ModLogItem, { IModLogItem, IModLogItemDocument } from '../models/ModLogItem';
import ModUser from '../models/ModUser';
import ModStrike from '../models/ModStrike';
import Guild from '../models/Guild';

// Variables and init
let client: Discord.Client;
let logger: winston.Logger;

const plannedUnmutes = {};

Sentry.configureScope((scope) => {
	scope.setTag('module', 'moderation');
});

// Functions
export async function log(logItem: IModLogItem|IModLogItemDocument, color: string): Promise<void> {
	const offender = await client.users.fetch(logItem.userId)
		.catch((e) => {
			Sentry.captureException(e);
			logger.error(e, { labels: { module: 'moderation', event: ['log', 'discord'] } });
			throw new Error('Something went wrong during logging the moderation action.');
		});

	const moderator = await client.users.fetch(logItem.moderator)
		.catch((e) => {
			Sentry.captureException(e);
			logger.error(e, { labels: { module: 'moderation', event: ['log', 'discord'] } });
			throw new Error('Something went wrong during logging the moderation action.');
		});

	const embed = new MessageEmbed()
		// @ts-expect-error _id not existing on IModLogItem
		.setTitle(`${logItem.type}${logItem._id ? ` | case ${logItem._id}` : ''}`)
		.setDescription(`**Offender:** ${offender.tag}${logItem.duration ? `\n**Duration:** ${logItem.duration}` : ''}\n**Reason:** ${logItem.reason}\n**Moderator:** ${moderator.tag}`)
		.setFooter(`ID: ${logItem.userId}`)
		.setColor(color)
		.setTimestamp();

	// TODO: Get modlog channel and send embed
	client.channels.fetch('761891288509186048')
		// @ts-expect-error Discord.Channel missing properties of Discord.TextChannel
		.then((channel: Discord.TextChannel) => channel.send(embed));
}

/*
 !	This function may not have use, as deleted accounts still show up in the API and there's no good
 !	way to differentiate an actual deleted account from a renamed account
 */
// eslint-disable-next-line no-unused-vars
async function updateMember(member: Discord.GuildMember): Promise<void> {
	const user = await ModUser.findById(member.id).exec()
		.catch((e) => {
			Sentry.captureException(e);
			logger.error(e, { labels: { module: 'moderation', event: ['updateMember', 'databaseSearch'] } });
			throw new Error('Something went wrong updating the user.');
		});

	if (!user) {
		const newUser = new ModUser({
			_id: member.id,
			lastKnownTag: member.user.tag,
		});

		newUser.save((e) => {
			if (e) {
				Sentry.captureException(e);
				logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['updateMember', 'databaseSave'] } });
				throw new Error('Something went wrong updating the user.');
			}
		});
	} else {
		user.lastKnownTag = member.user.tag;
		user.save((e) => {
			if (e) {
				Sentry.captureException(e);
				logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['updateMember', 'databaseSave'] } });
				throw new Error('Something went wrong updating the user.');
			}
		});
	}
}

// eslint-disable-next-line max-len
export async function warn(member: Discord.GuildMember, reason: string, moderator: Discord.GuildMember): Promise<void|object> {
	const logItem = new ModLogItem({
		userId: member.id,
		moderator: moderator.id,
		guildId: member.guild.id,
		reason,
		type: 'warn',
	});

	await logItem.save((e) => {
		if (e) {
			Sentry.captureException(e);
			logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['warn', 'databaseSave'] } });
			throw new Error('Logging the warn failed');
		}
	});

	await log(logItem, '#ffde26').catch((e) => {
		throw e;
	});

	const embed = new MessageEmbed()
		.setTitle('Warn')
		.setDescription(`You have been warned for: ${reason}\n\nNote: Warns do **NOT** count as strikes`)
		.setFooter(`Issued in: ${member.guild.name}`)
		.setTimestamp();

	await member.send(embed)
		.catch(() => ({ info: 'failed to send DM' }));
}

// eslint-disable-next-line max-len
export async function unmute(member: Discord.GuildMember, reason?: string, moderator?: Discord.GuildMember): Promise<void> {
	const guild = await Guild.findById(member.guild.id).exec()
		.catch((e) => {
			Sentry.captureException(e);
			logger.error(e, { labels: { module: 'moderation', event: ['unmute', 'databaseSearch'] } });
			throw new Error('Something went wrong fetching the server settings.');
		});

	if (!guild?.settings?.moderation?.muteRole) throw new Error('Unable to find the mute role in the server settings');
	if (!member.roles.cache.has(guild.settings.moderation.muteRole)) throw new Error('That member is not muted');

	await member.roles.remove(guild.settings.moderation.muteRole, reason ?? 'Automatic unmute');

	await log({
		userId: member.id,
		guild: member.guild.id,
		type: 'unmute',
		reason: reason ?? 'Automatic unmute',
		// @ts-expect-error client.user.id possibly null
		moderator: moderator?.id ?? client.user.id,
	} as IModLogItem, '#2bad64').catch((e) => {
		throw e;
	});

	await ActiveMute.findOneAndDelete({ userId: member.id, guild: member.guild.id }).exec()
		.catch((e) => {
			Sentry.captureException(e);
			logger.error(e, { labels: { module: 'moderation', event: ['unmute', 'databaseSave'] } });
			throw new Error('Something went wrong, please try again.');
		});
}

// eslint-disable-next-line max-len
export async function mute(member: Discord.GuildMember, duration: number, reason: string, moderator: Discord.GuildMember) {
	// TODO: Check for existing mute and compare durations to override or cancel
	const expirationDate = moment().add(duration, 'minutes');

	const logItem = new ModLogItem({
		userId: member.id,
		guild: member.guild.id,
		type: 'mute',
		reason,
		moderator: moderator.id,
		duration: humanizeDuration(moment.duration(duration, 'minutes').asMilliseconds(), { largest: 2, round: true }),
	} as IModLogItem);

	await logItem.save((e) => {
		if (e) {
			Sentry.captureException(e);
			logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['mute', 'databaseSave'] } });
			throw new Error('Logging the mute failed');
		}
	});
	await log(logItem, '#ff9c24');

	// TODO: Don't add strike if guild disabled it
	const strikeItem = new ModStrike({
		id: logItem.id,
		userId: member.id,
		guild: member.guild.id,
	});

	await strikeItem.save((e) => {
		if (e) {
			Sentry.captureException(e);
			logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['mute', 'databaseSave'] } });
			throw new Error('Saving the strike failed');
		}
	});

	await ActiveMute.findOneAndDelete({ userId: member.id, guild: member.guild.id }).exec()
		.catch((e) => {
			Sentry.captureException(e);
			logger.error(e, { labels: { module: 'moderation', event: ['unmute', 'databaseSave'] } });
			throw new Error('Something went wrong, please try again.');
		});

	const muteDoc = new ActiveMute({
		id: logItem.id,
		expireAt: expirationDate.toDate(),
		userId: member.id,
		guild: member.guild.id,
	} as IActiveMute);

	await muteDoc.save((e) => {
		if (e) {
			Sentry.captureException(e);
			logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['mute', 'databaseSave'] } });
			throw new Error('Saving the mute failed');
		}
	});

	// TODO: Plan unmute and add mute role
}

export async function hardMute(member: Discord.GuildMember, moderator: Discord.GuildMember) {
	const doc = await ActiveMute.findOne({ userId: member.id, guild: member.guild.id }).exec()
		.catch((e) => {
			Sentry.captureException(e);
			logger.error(e, { labels: { module: 'moderation', event: ['hardMute', 'databaseSearch'] } });
			throw new Error('Something went wrong, please try again.');
		});

	if (!doc) throw new Error('Member is not muted');

	// TODO: Get muted role
	const mutedRole = {
		value: 'stuff',
	};

	doc.roles = await member.roles.cache.map((role) => role.id);
	const index = doc.roles.findIndex((role) => role === mutedRole.value);
	await doc.roles.splice(index, 1);
	doc.hardMute = true;

	await member.roles.remove(doc.roles);
	await doc.save((e) => {
		if (e) {
			Sentry.captureException(e);
			logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['hardMute', 'databaseSave'] } });
			throw new Error('Saving the mute failed');
		}
	});

	await log({
		type: 'hardmute',
		userId: member.id,
		moderator: moderator.id,
		reason: 'N/A',
	} as IModLogItem, '#ff9c24');
}

// eslint-disable-next-line max-len
export async function kick(member: Discord.GuildMember, reason: string, moderator: Discord.GuildMember) {
	const logItem = new ModLogItem({
		userId: member.id,
		guild: member.guild.id,
		type: 'kick',
		reason,
		moderator: moderator.id,
	} as IModLogItem);

	await logItem.save((e) => {
		if (e) {
			Sentry.captureException(e);
			logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['kick', 'databaseSave'] } });
			throw new Error('Logging the kick failed');
		}
	});
	await log(logItem, '#ff9c24');

	const strikeItem = new ModStrike({
		id: logItem.id,
		userId: member.id,
		guild: member.guild.id,
	});

	await strikeItem.save((e) => {
		if (e) {
			Sentry.captureException(e);
			logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['kick', 'databaseSave'] } });
			throw new Error('Saving the strike failed');
		}
	});

	const embed = new MessageEmbed()
		.setTitle('Kick')
		.setDescription(`You have been kicked for: ${reason}`)
		.setFooter(`Issued in: ${member.guild.name}`)
		.setTimestamp();

	await member.send(embed)
		.catch(() => {});

	await member.kick(reason)
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['kick', 'discord'] } });
			throw new Error('Something went wrong, please try again.');
		});
}

// TODO: Write tempban function
// eslint-disable-next-line max-len
export async function tempBan(member: Discord.GuildMember, duration: number, reason: string, moderator: Discord.GuildMember) {

}

// eslint-disable-next-line max-len
export async function ban(member: Discord.GuildMember, reason: string, moderator: Discord.GuildMember) {
	const logItem = new ModLogItem({
		userId: member.id,
		guild: member.guild.id,
		type: 'ban',
		reason,
		moderator: moderator.id,
	} as IModLogItem);

	await logItem.save((e) => {
		if (e) {
			Sentry.captureException(e);
			logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['ban', 'databaseSave'] } });
			throw new Error('Logging the kick failed');
		}
	});
	await log(logItem, '#ff9c24');

	const strikeItem = new ModStrike({
		id: logItem.id,
		userId: member.id,
		guild: member.guild.id,
	});

	await strikeItem.save((e) => {
		if (e) {
			Sentry.captureException(e);
			logger.error(<string><unknown>e, { labels: { module: 'moderation', event: ['ban', 'databaseSave'] } });
			throw new Error('Saving the strike failed');
		}
	});

	await ActiveMute.findOneAndDelete({ userId: member.id, guild: member.guild.id }).exec()
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['ban', 'databaseSave'] } });
			throw new Error('Something went wrong, please try again.');
		});

	const embed = new MessageEmbed()
		.setTitle('Ban')
		.setDescription(`You have been banned for: ${reason}`)
		.setFooter(`Issued in: ${member.guild.name}`)
		.setTimestamp();

	await member.send(embed)
		.catch(() => {});

	await member.ban({ reason })
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['ban', 'discord'] } });
			throw new Error('Something went wrong, please try again.');
		});
}

// eslint-disable-next-line max-len
export async function strike(member: Discord.GuildMember, reason: string, moderator: Discord.GuildMember) {
	const strikes = await ModStrike.find({ userId: member.id, guild: member.guild.id }).lean().exec()
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['strike', 'databaseSearch'] } });
			throw new Error('Something went wrong, please try again.');
		});

	const guild = await Guild.findById(member.guild.id).lean().exec()
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'moderation', event: ['strike', 'databaseSearch'] } });
			throw new Error('Something went wrong, please try again.');
		});

	const currentStrike = guild?.settings.moderation.strikeSystem[strikes.length];
	if (!currentStrike) throw new Error('Something went wrong, please try again.');

	if (currentStrike.type === 'mute') {
		await mute(member, <number>currentStrike.duration, reason, moderator)
			.catch((err) => {
				throw err;
			});
	} else if (currentStrike.type === 'kick') {
		await kick(member, reason, moderator)
			.catch((err) => {
				throw err;
			});
	} else if (currentStrike.type === 'tempban') {
		await tempBan(member, <number>currentStrike.duration, reason, moderator)
			.catch((err) => {
				throw err;
			});
	} else if (currentStrike.type === 'ban') {
		await ban(member, reason, moderator)
			.catch((err) => {
				throw err;
			});
	}
}

export function init(newClient: Discord.Client, newLogger: winston.Logger) {
	client = newClient;
	logger = newLogger;

	// TODO: Plan unmutes
}
