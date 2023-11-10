const { PrismaClient } = require('@prisma/client');
const config = require('../config.js');
const parseDuration = require('parse-duration');

const modlog = require('./data/backend.modlog.json');
const strikes = require('./data/backend.strikes.json');
const users = require('./data/backend.users.json');

async function main() {
	const db = new PrismaClient({
		datasources: {
			db: {
				url: `${config.db.protocol}://${config.db.username}:${config.db.password}@${config.db.host}/${config.db.database}${config.db.query ?? ''}`,
			},
		},
	});

	const transactions = [];

	users.forEach((user) => {
		transactions.push(
			db.moderationUser.create({
				data: {
					id: user._id,
					lastKnownTag: user.lastKnownTag,
				},
			}),
		);

		user.notes.forEach((note) => {
			transactions.push(
				db.note.create({
					data: {
						note: note.value,
						guildId: '660839081558933555',
						userId: user._id,
						date: new Date(0),
					}
				}),
			);
		});
	});

	modlog.forEach((logItem) => {
		const strikeCount = strikes.filter((strike) => Math.abs(strike._id) === logItem._id).length;

		transactions.push(
			db.moderationLogItem.create({
				data: {
					type: 'MANUAL',
					action: logItem.type.toUpperCase(),
					moderatorId: logItem.moderator,
					reason: logItem.reason,
					date: logItem.date ? new Date(logItem.date.$date) : new Date(0),
					offenderId: logItem.userId,
					duration: logItem.duration ? parseDuration(logItem.duration) : undefined,
					strikes: strikeCount !== 0 ? strikeCount : undefined,
					strikeDate: logItem.date ? new Date(logItem.date.$date) : new Date(0),
					guildId: '660839081558933555',
				},
			}),
		);
	});

	await db.$transaction(transactions);
}

void main();
