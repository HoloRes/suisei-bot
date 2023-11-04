import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import {
	ActionRowBuilder,
	EmbedBuilder,
	ModalBuilder,
	PermissionFlagsBits,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities';

@ApplyOptions<Subcommand.Options>({
	name: 'note',
	description: 'Manage notes for an user',
	subcommands: [
		{
			name: 'add',
			chatInputRun: 'chatInputAdd',
		},
		{
			name: 'edit',
			chatInputRun: 'chatInputEdit',
		},
		{
			name: 'get',
			chatInputRun: 'chatInputGet',
		},
		{
			name: 'list',
			chatInputRun: 'chatInputList',
		},
	],
	preconditions: ['ValidModerationConfig'],
})
export class NoteCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
				.addSubcommand((command) => command
					.setName('add')
					.setDescription('Add a note')
					.addUserOption((optBuilder) => optBuilder
						.setName('user')
						.setDescription('User to add a note to')
						.setRequired(true)))
				.addSubcommand((command) => command
					.setName('edit')
					.setDescription('Edit a note')
					.addIntegerOption((optBuilder) => optBuilder
						.setName('id')
						.setDescription('Id of the note to edit')
						.setRequired(true)))
				.addSubcommand((command) => command
					.setName('get')
					.setDescription('Get a note')
					.addIntegerOption((optBuilder) => optBuilder
						.setName('id')
						.setDescription('Id of the note')
						.setRequired(true)))
				.addSubcommand((command) => command
					.setName('list')
					.setDescription('List notes of an user')
					.addUserOption((optBuilder) => optBuilder
						.setName('user')
						.setDescription('User to get notes from')
						.setRequired(true)));
		});
	}

	public async chatInputAdd(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);

		const modal = new ModalBuilder()
			.setCustomId(`moderation:note:create:${user.id}:${interaction.user.id}`)
			.setTitle(`Creating note for: ${user.tag}`);

		const noteInput = new TextInputBuilder()
			.setCustomId('note')
			.setLabel('Note')
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(true);

		const row = new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput);

		modal.addComponents(row);

		await interaction.showModal(modal);
	}

	public async chatInputEdit(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const id = interaction.options.getInteger('id', true);

		const note = await this.container.db.note.findFirst({
			where: {
				id,
				guildId: interaction.guildId,
			},
		});

		if (!note) {
			await interaction.reply('No note found with that id.');
			return;
		}

		const modal = new ModalBuilder()
			.setCustomId(`moderation:note:edit:${note.id}:${interaction.user.id}`)
			.setTitle(`Editing note #${note.id}`);

		const noteInput = new TextInputBuilder()
			.setCustomId('note')
			.setLabel('Note')
			.setStyle(TextInputStyle.Paragraph)
			.setValue(note.note)
			.setRequired(true);

		const row = new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput);

		modal.addComponents(row);

		await interaction.showModal(modal);
	}

	public async chatInputGet(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const id = interaction.options.getInteger('id', true);

		await interaction.deferReply();

		const note = await this.container.db.note.findFirst({
			where: {
				id,
				guildId: interaction.guildId,
			},
		});

		if (!note) {
			await interaction.editReply('No note found with this id.');
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle(`Note #${note.id}`)
			.setDescription(
				note.note.length > 1000
					? `${note.note.substring(0, 1000)}...`
					: note.note,
			)
			.setColor(0x61cdff)
			.setFooter({ text: `User: ${note.userId}` })
			.setTimestamp(note.date);

		let content: string | undefined;
		if (note.note.length > 1000) {
			content = 'This note is cut off, you can find the full note in the web ui.';
		}

		await interaction.editReply({
			content,
			embeds: [embed],
		});
	}

	public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);

		await interaction.deferReply();

		const notes = await this.container.db.note.findMany({
			where: {
				userId: user.id,
				guildId: interaction.guildId,
			},
		});

		if (notes.length === 0) {
			await interaction.editReply('No notes found for that user.');
			return;
		}

		await interaction.editReply({
			embeds: [
				new EmbedBuilder({
					title: `Notes for ${user.tag}`,
					color: 0x61cdff,
					timestamp: Date.now(),
				}),
			],
		});
		const msg = await interaction.fetchReply();

		await new PaginatedMessageEmbedFields()
			.setTemplate({
				title: `Notes for ${user.tag}`,
				timestamp: Date.now(),
				color: 0x61cdff,
			})
			.setItems(notes.map((note) => ({
				name: `#${note.id}`,
				value: note.note.length > 100
					? `${note.note.substring(0, 100)}...`
					: note.note,
				inline: true,
			})))
			.setItemsPerPage(8)
			.make()
			.run(msg);
	}
}
