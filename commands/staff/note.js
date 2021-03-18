// Imports
const { MessageEmbed } = require('discord.js');

// Local files
const moderation = require('$/util/moderation');
const config = require('$/config.json');

const urlRegex = /https?(:\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[A-Z0-9+&@#/%=~_|$])/igm;

exports.run = async (client, message, args) => {
	if (args.length < 1 || args[0].length === 0) return message.channel.send(`**USAGE:** ${config.discord.prefix}note <member> <add/edit/remove/list> <note/noteid> <note (update)>`);

	const member = await moderation.getMemberFromMessage(message, args)
		.catch((err) => message.channel.send(err.info));

	if (!member.user) return;
	if (!args[1] || args[1].toLowerCase() === 'list') {
		const { data: notes } = await moderation.getNotes(member);

		if (notes.length === 0) {
			const embed = new MessageEmbed()
				.setAuthor(member.user.tag, member.user.displayAvatarURL())
				.setDescription('No notes found for this user')
				.setTimestamp();

			message.channel.send(embed);
		} else if (notes.length > 12) {
			const pages = Math.ceil(notes.length / 12);
			const embeds = [];
			let currentPage = 0;

			// eslint-disable-next-line no-plusplus
			for (let i = 0; i < pages; i++) {
				const offset = 12 * i;
				embeds[i] = new MessageEmbed()
					.setTitle(member.user.tag)
					.setTimestamp();
				if (i + 1 === pages) {
					const left = notes.length - offset;
					// eslint-disable-next-line no-plusplus
					for (let x = 0; x < left; x++) {
						const note = notes[offset + x];
						embeds[i].addField(`Note #${note._id}`, note.value.replace(urlRegex, '[link]($&)'), true);
					}
				} else {
					// eslint-disable-next-line no-plusplus
					for (let x = 0; x < 12; x++) {
						const note = notes[offset + x];
						embeds[i].addField(`Note #${note._id}`, note.value.replace(urlRegex, '[link]($&)'), true);
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
				.setTitle(member.user.tag)
				.setTimestamp();

			notes.forEach((note) => embed.addField(`Note #${note._id}`, note.value.replace(urlRegex, '[link]($&)'), true));

			message.channel.send(embed);
		}
	} else if (args[1] === 'add') {
		const note = args.slice(2).join(' ');
		if (note.length === 0) return message.channel.send("Error: Note can't be empty");
		if (note.length > 1000) return message.channel.send('Error: Note is over 1000 characters');

		moderation.addNote(member, note)
			.then(() => {
				message.channel.send(`Note taken for: **${member.user.tag}**\n**Note:** ${note}`);
			})
			.catch(() => message.channel.send('Something went wrong, please try again.'));
	} else if (args[1] === 'edit') {
		const noteId = Number.parseInt(args[2], 10);
		if (Number.isNaN(noteId) || noteId < 0) return message.channel.send('Invalid note id');

		const note = args.slice(3).join(' ');
		if (note.length === 0) return message.channel.send("Error: Note can't be empty");
		if (note.length > 1000) return message.channel.send('Error: Note is over 1000 characters');

		moderation.updateNote(member, noteId, note)
			.then(() => {
				message.channel.send(`Note taken updated: **${member.user.tag}**\n**Note:** ${note}`);
			})
			.catch(() => message.channel.send('Something went wrong, please try again.'));
	} else if (args[1] === 'remove') {
		const noteId = Number.parseInt(args[2], 10);
		if (Number.isNaN(noteId) || noteId < 0) return message.channel.send('Invalid note id');

		moderation.removeNote(member, noteId)
			.then(() => {
				message.channel.send('Note removed');
			})
			.catch((err) => message.channel.send(err.info ? err.info : 'Something went wrong, please try again.'));
	} else {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}note <member> <add/remove/list> <note/noteid>`);
	}
};

exports.config = {
	command: 'note',
};
