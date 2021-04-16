// Packages
import moment from 'moment';
import { scheduleJob } from 'node-schedule';
import humanizeDuration from 'humanize-duration';
import Sentry from '@sentry/node';
import Discord, { MessageEmbed } from 'discord.js';
import winston from 'winston';

// Models
import ActiveMute from '../models/ActiveMute';
import ModLogItem, { IModLogItem } from '../models/ModLogItem';
import ModUser from '../models/ModUser';
import ModStrike from '../models/ModStrike';

// Variables and init
let client: Discord.Client;
let logger: winston.Logger;

const plannedUnmutes = {};

Sentry.configureScope((scope) => {
	scope.setTag('module', 'moderation');
});

class ModerationError extends Error {
	public readonly info: string | undefined;

	constructor(message: string, info: string) {
		super();
		this.info = info ?? undefined;
	}
}

// Functions
export async function log(logItem: IModLogItem, color: string): Promise<void> {
	const offender = await client.users.fetch(logItem.userId)
		.catch((e) => {
			Sentry.captureException(e);
			logger.error(e, { labels: { module: 'moderation', event: ['log', 'discord'] } });
			throw new ModerationError(e.message, 'Something went wrong during logging the moderation action.');
		});

	const moderator = await client.users.fetch(logItem.moderator)
		.catch((e) => {
			Sentry.captureException(e);
			logger.error(e, { labels: { module: 'moderation', event: ['log', 'discord'] } });
			throw new ModerationError(e.message, 'Something went wrong during logging the moderation action.');
		});

	const embed = new MessageEmbed()
		.setTitle(`${logItem.type}${logItem._id ? ` | case ${logItem._id}` : ''}`)
		.setDescription(`**Offender:** ${offender.tag}${logItem.duration ? `\n**Duration:** ${logItem.duration}` : ''}\n**Reason:** ${logItem.reason}\n**Moderator:** ${moderator.tag}`)
		.setFooter(`ID: ${logItem.userId}`)
		.setColor(color)
		.setTimestamp();

	// TODO: Get modlog channel and send embed
}

export async function warn(member, reason, moderator): Promise<void> {

}

export function init(newClient: Discord.Client, newLogger: winston.Logger) {
	client = newClient;
	logger = newLogger;

	// TODO: Plan unmutes
}
