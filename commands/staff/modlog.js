// Imports
const { MessageEmbed } = require('discord.js');

// Local files
const moderation = require('$/util/moderation');
const config = require('$/config.json');

exports.run = async (client, message, args) => {
	if (args.length < 1) return message.channel.send(`**USAGE:** ${config.discord.prefix}modlog <member>`);

	const member = await moderation.getMemberFromMessage(message, args)
		.catch((err) => message.channel.send(err.info));

	const { data } = await moderation.getMemberModLogs(member)
		.catch(() => message.channel.send('Something went wrong, please try again.'));

	const embed = new MessageEmbed()
		.setAuthor(member.user.tag, member.user.displayAvatarURL())
		.setDescription(`Total strikes: **${data.strikes}** | Active strikes: **${data.activeStrikes}**`)
		.setTimestamp();

	if (data.logs.length === 0) embed.addField('No logs found for this user', '\u3164');
	else {
		data.logs.forEach((log) => {
			embed.addField(`#${log._id} | ${log.type}${log.duration ? ` | ${log.duration}` : ''}`, log.reason, true);
		});
	}

	message.channel.send(embed);
};

exports.config = {
	command: 'modlog',
};
