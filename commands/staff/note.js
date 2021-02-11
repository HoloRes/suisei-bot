// Imports
const { MessageEmbed } = require('discord.js');

// Local files
const { logger } = require('$/index');
const moderation = require('$/util/moderation');
const config = require('$/config.json');

exports.run = async (client, message, args) => {
	if (args.length < 1) return message.channel.send(`**USAGE:** ${config.discord.prefix}note <member> <add/remove/list> <note/noteid>`);

	const member = await moderation.getMemberFromMessage(message, args)
		.catch((err) => message.channel.send(err));

	if (!args[1] || args[1].toLowerCase() === 'list') {
		const { data: notes } = await moderation.getNotes(member);

		const embed = new MessageEmbed()
			.setTitle(member.user.tag)
			.setTimestamp();

		if (notes.length === 0) embed.setDescription('No notes found for this user');
		else {
			notes.forEach((note) => {
				embed.addField(`Note #${note._id}`, note.value, true);
			});
		}

		message.channel.send(embed);
	} else if (args[1] === 'add') {
		const note = args.slice(2).join(' ');
		if (note.length > 1000) return message.channel.send('Error: Note is over 1000 characters');

		moderation.addNote(member, note)
			.then(() => {
				message.channel.send(`Note taken for: **${member.user.tag}**\n**Note:** ${note}`);
			})
			.catch((err) => {
				logger.error(err);
				return message.channel.send('Something went wrong, please try again.');
			});
	} else if (args[1] === 'remove') {
		const noteId = Number.parseInt(args[2], 10);
		if (Number.isNaN(noteId) || noteId < 0) return message.channel.send('Invalid note id');

		moderation.removeNote(member, noteId)
			.then(() => {
				message.channel.send('Note removed');
			})
			.catch((err) => {
				logger.error(err);
				return message.channel.send(err.info ? err.info : 'Something went wrong, please try again.');
			});
	} else {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}note <member> <add/remove/list> <note/noteid>`);
	}
};

exports.config = {
	command: 'note',
};
