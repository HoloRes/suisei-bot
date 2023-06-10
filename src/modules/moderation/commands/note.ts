import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { PermissionFlagsBits } from 'discord.js';

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
					.addUserOption((optBuilder) => optBuilder
						.setName('user')
						.setDescription('User to add a note to')
						.setRequired(true))
					.addStringOption((optBuilder) => optBuilder
						.setName('title')
						.setDescription('Title of the note to edit')
						.setRequired(true)
						.setAutocomplete(true)))
				.addSubcommand((command) => command
					.setName('get')
					.setDescription('Get a note')
					.addUserOption((optBuilder) => optBuilder
						.setName('user')
						.setDescription('User')
						.setRequired(true))
					.addStringOption((optBuilder) => optBuilder
						.setName('title')
						.setDescription('Title of the note')
						.setRequired(true)
						.setAutocomplete(true)))
				.addSubcommand((command) => command
					.setName('list')
					.setDescription('List notes of an user')
					.addUserOption((optBuilder) => optBuilder
						.setName('user')
						.setDescription('User to add a note to')
						.setRequired(true)));
		});
	}

	public async chatInputAdd(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply('Not implemented yet');
		// Use modal
	}

	public async chatInputEdit(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply('Not implemented yet');
		// Use modal
	}

	public async chatInputGet(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply('Not implemented yet');
	}

	public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply('Not implemented yet');
	}

	public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
		await interaction.respond([]);
	}
}
