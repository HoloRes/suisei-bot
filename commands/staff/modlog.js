// Imports
const { MessageEmbed } = require('discord.js');

// Local files
const moderation = require('$/util/moderation');
const config = require('$/config.json');

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

exports.run = async (client, message, args) => {
	if (args.length < 1) return message.channel.send(`**USAGE:** ${config.discord.prefix}modlog <member>`);

	const member = await moderation.getMemberFromMessage(message, args)
		.catch((err) => message.channel.send(err.info));

	const { data } = await moderation.getMemberModLogs(member)
		.catch(() => message.channel.send('Something went wrong, please try again.'));

	if (data.logs.length === 0) {
		const embed = new MessageEmbed()
			.setAuthor(member.user.tag, member.user.displayAvatarURL())
			.setDescription(`Total strikes: **${data.strikes}** | Active strikes: **${data.activeStrikes}**`)
			.addField('No logs found for this user', '\u3164')
			.setTimestamp();

		message.channel.send(embed);
	} else if (data.logs.length > 12) {
		const pages = Math.ceil(data.logs.length / 12);
		const embeds = [];
		let currentPage = 0;

		// eslint-disable-next-line no-plusplus
		for (let i = 0; i < pages; i++) {
			const offset = 12 * i;
			embeds[i] = new MessageEmbed()
				.setAuthor(member.user.tag, member.user.displayAvatarURL())
				.setDescription(`Total strikes: **${data.strikes}** | Active strikes: **${data.activeStrikes}**`)
				.setTimestamp();
			if (i + 1 === pages) {
				const left = data.logs.length - offset;
				// eslint-disable-next-line no-plusplus
				for (let x = 0; x < left; x++) {
					const log = data.logs[offset + x];
					embeds[i].addField(`#${log._id} | ${log.type}${log.duration ? ` | ${log.duration}` : ''}${log.date ? ` | ${log.date.getUTCDate()} ${months[log.date.getUTCMonth()]} ${log.date.getUTCFullYear()}` : ''}`, log.reason, true);
				}
			} else {
				// eslint-disable-next-line no-plusplus
				for (let x = 0; x < 12; x++) {
					const log = data.logs[offset + x];
					embeds[i].addField(`#${log._id} | ${log.type}${log.duration ? ` | ${log.duration}` : ''}${log.date ? ` | ${log.date.getUTCDate()} ${months[log.date.getUTCMonth()]} ${log.date.getUTCFullYear()}` : ''}`, log.reason, true);
				}
			}
		}

		message.channel.send(embeds[0])
			.then(async (msg) => {
				await msg.react('◀️');
				await msg.react('▶️');

				const filter = (reaction) => ['◀️', '▶️'].includes(reaction.emoji.name);
				const collector = msg.createReactionCollector(filter, { time: 60000 });

				collector.on('collect', (r) => {
					if (r.emoji.name === '◀️' && currentPage > 0) {
						currentPage -= 1;
						msg.edit(embeds[currentPage]);
					} else if (r.emoji.name === '▶️' && currentPage < pages - 1) {
						currentPage += 1;
						msg.edit(embeds[currentPage]);
					}
				});

				collector.on('end', () => {
					msg.reactions.removeAll();
				});
			});
	} else {
		const embed = new MessageEmbed()
			.setAuthor(member.user.tag, member.user.displayAvatarURL())
			.setDescription(`Total strikes: **${data.strikes}** | Active strikes: **${data.activeStrikes}**`)
			.setTimestamp();

		data.logs.forEach((log) => {
			embed.addField(`#${log._id} | ${log.type}${log.duration ? ` | ${log.duration}` : ''}${log.date ? ` | ${log.date.getUTCDate()} ${months[log.date.getUTCMonth()]} ${log.date.getUTCFullYear()}` : ''}`, log.reason, true);
		});

		message.channel.send(embed);
	}
};

exports.config = {
	command: 'modlog',
};
