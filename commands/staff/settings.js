// Imports
const { MessageEmbed } = require('discord.js');
const Sentry = require('@sentry/node');

// Models
const Setting = require('$/models/setting');

// Local files
const config = require('$/config.json');
const { logger, client } = require('$/index');

// Init
const availableSettings = [ // Available types: user, role, channel, string
	{ name: 'mutedRole', type: 'role' },
	{ name: 'modLogChannel', type: 'channel' },
	{ name: 'triviaChannel', type: 'channel' },
	{ name: 'triviaTrainChannel', type: 'channel' },
	{ name: 'triviaQuestionsUrl', type: 'string' },
	{ name: 'triviaPingRole', type: 'role' },
];

// Functions
function setSetting(message, setting, value) {
	return new Promise((resolve) => {
		Setting.findById(setting, (err, doc) => {
			if (err) {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'commands', event: ['settings', 'databaseSearch'] } });
				return message.channel.send('Something went wrong, please try again.')
					.then(() => {
						resolve(false);
					});
			}

			if (!doc) {
				const settingDoc = new Setting({
					_id: setting,
					value,
				});
				settingDoc.save((err2) => {
					if (err2) {
						Sentry.captureException(err2);
						logger.error(err2, { labels: { module: 'commands', event: ['settings', 'databaseSave'] } });
						resolve(false);
						return message.channel.send('Something went wrong, please try again.');
					} resolve(true);
				});
			} else {
				// eslint-disable-next-line no-param-reassign
				doc.value = value;
				doc.save((err2) => {
					if (err2) {
						Sentry.captureException(err2);
						logger.error(err2, { labels: { module: 'commands', event: ['settings', 'databaseSave'] } });
						resolve(false);
						return message.channel.send('Something went wrong, please try again.');
					} resolve(true);
				});
			}
		});
	});
}

function getUser(message, arg) {
	return new Promise((resolve) => {
		if (message.mentions.members.size === 1) {
			resolve(message.mentions.members.first());
		} else {
			message.guild.members.fetch(arg)
				.then((member) => resolve(member))
				.catch(() => {
					message.guild.members.fetch()
						.then(() => {
							const member = message.guild.members.cache.find(
								(cachedMember) => cachedMember.user.tag.toLowerCase() === arg.toLowerCase(),
							);
							return resolve(member);
						});
				});
		}
	});
}

function getRole(message, arg) {
	return new Promise((resolve) => {
		if (message.mentions.roles.size === 1) {
			resolve(message.mentions.roles.first());
		} else {
			message.guild.roles.fetch(arg)
				.then((role) => resolve(role))
				.catch(() => {
					message.guild.roles.fetch()
						.then(() => {
							const role = message.guild.roles.cache.find(
								(cachedRole) => cachedRole.name.toLowerCase() === arg.toLowerCase(),
							);
							return resolve(role);
						});
				});
		}
	});
}

function getChannel(message, arg) {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve) => {
		if (message.mentions.channels.size === 1) {
			resolve(message.mentions.channels.first());
		} else {
			client.channels.fetch(arg)
				.then((channel) => resolve(channel))
				.catch(() => {
					client.channels.fetch()
						.then(() => {
							const channel = message.guild.channels.cache.find(
								(cachedChannel) => cachedChannel.name.toLowerCase() === arg.toLowerCase(),
							);
							return resolve(channel);
						});
				});
		}
	});
}

function send(message, setting, value) {
	const embed = new MessageEmbed()
		.setTitle(`Current value for: ${setting.name}`)
		.setDescription(value);
	message.channel.send('', { embed, disableMentions: true });
}

// Command
exports.run = async (client, message, args) => {
	if (!args[0]) return message.channel.send(`**USAGE:** ${config.discord.prefix}settings <setting> <value>`);

	let settings = '';
	availableSettings.forEach((setting, index) => {
		settings += `${setting.name}${index !== availableSettings.length - 1 ? ', ' : ''}`;
	});

	const setting = await availableSettings.find(
		(item) => item.name.toLowerCase() === args[0].toLowerCase(),
	);
	if (!setting) return message.channel.send(`Non existent setting, available settings: ${settings}`);

	if (!args[1]) {
		return Setting.findById(setting.name, (err, doc) => {
			if (err) {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'commands', event: ['settings', 'databaseSearch'] } });
				return message.channel.send('Something went wrong, please try again.');
			}

			if (!doc) {
				const embed = new MessageEmbed()
					.setTitle(`Current value for: ${setting.name}`)
					.setDescription('None');
				message.channel.send(embed);
			} else {
				switch (setting.type) {
				case 'string':
					send(message, setting, doc.value);
					break;
				case 'user':
					send(message, setting, `<@${doc.value}>`);
					break;
				case 'role':
					send(message, setting, `<@&${doc.value}>`);
					break;
				case 'channel':
					send(message, setting, `<#${doc.value}>`);
					break;
				default:
					break;
				}
			}
		});
	}
	const value = args.slice(1).join(' ');

	if (setting.type === 'string') {
		setSetting(message, setting.name, value)
			.then((succeeded) => {
				if (succeeded) {
					const embed = new MessageEmbed()
						.setTitle(`Changed setting: ${setting.name}`)
						.setDescription(`New value: ${value}`);
					message.channel.send(embed);
				} else {
					message.channel.send('Something went wrong, please try again.');
				}
			});
	} else if (setting.type === 'user') {
		const user = await getUser(message, value);
		if (!user) return message.channel.send('Member not found.');

		setSetting(message, setting.name, user.id)
			.then((succeeded) => {
				if (succeeded) {
					const embed = new MessageEmbed()
						.setTitle(`Changed setting: ${setting.name}`)
						.setDescription(`New value: <@${user.id}>`);
					message.channel.send(embed);
				} else {
					message.channel.send('Something went wrong, please try again.');
				}
			});
	} else if (setting.type === 'role') {
		const role = await getRole(message, value);
		if (!role) return message.channel.send('Role not found.');

		setSetting(message, setting.name, role.id)
			.then((succeeded) => {
				if (succeeded) {
					const embed = new MessageEmbed()
						.setTitle(`Changed setting: ${setting.name}`)
						.setDescription(`New value: <@&${role.id}>`);
					message.channel.send(embed);
				} else {
					message.channel.send('Something went wrong, please try again.');
				}
			});
	} else if (setting.type === 'channel') {
		const channel = await getChannel(message, value);
		if (!channel) return message.channel.send('Channel not found.');

		setSetting(message, setting.name, channel.id)
			.then((succeeded) => {
				if (succeeded) {
					const embed = new MessageEmbed()
						.setTitle(`Changed setting: ${setting.name}`)
						.setDescription(`New value: <#${channel.id}>`);
					message.channel.send(embed);
				} else {
					message.channel.send('Something went wrong, please try again.');
				}
			});
	}
};

exports.config = {
	command: 'settings',
};
