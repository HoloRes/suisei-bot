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
	// Ignore error, since it has no high importance
	updateMember(member).catch(() => {});

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

export async function mute(member: Discord.GuildMember, duration: number, reason: string, moderator: Discord.GuildMember, tos?: boolean) {
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

	const strike = new ModStrike({
		id: logItem.id,
		userId: member.id,
		guild: member.guild.id,
		tos,
	});

	await strike.save((e) => {
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
}

export function init(newClient: Discord.Client, newLogger: winston.Logger) {
	client = newClient;
	logger = newLogger;

	// TODO: Plan unmutes
}
