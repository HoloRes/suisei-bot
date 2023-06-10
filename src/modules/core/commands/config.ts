import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Subcommand.Options>({
	name: 'config',
	description: 'Update server settings',
	subcommands: [
		{
			name: 'set',
			chatInputRun: 'chatInputSet',
		},
		{
			name: 'get',
			chatInputRun: 'chatInputGet',
		},
	],
})
export class ConfigCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
				.addSubcommand((command) => command
					.setName('set')
					.setDescription('Set a config option')
					.addStringOption((optBuilder) => optBuilder
						.setRequired(true)
						.setName('module')
						.setDescription('Module to configure')
						.setAutocomplete(true))
					.addStringOption((optBuilder) => optBuilder
						.setRequired(true)
						.setName('key')
						.setDescription('Config key to set')
						.setAutocomplete(true))
					.addStringOption((optBuilder) => optBuilder
						.setRequired(true)
						.setName('value')
						.setDescription('Value to set it to')))
				.addSubcommand((command) => command
					.setName('get')
					.setDescription('Get a config value')
					.addStringOption((optBuilder) => optBuilder
						.setRequired(true)
						.setName('module')
						.setDescription('Module to configure')
						.setAutocomplete(true))
					.addStringOption((optBuilder) => optBuilder
						.setRequired(true)
						.setName('key')
						.setDescription('Config key to get')
						.setAutocomplete(true)));
		});
	}

	public async chatInputSet(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply('Not implemented yet');
	}

	public async chatInputGet(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply('Not implemented yet');
	}

	public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
		return interaction.respond([]);
	}
}
