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
						.setDescription('Module to configure'))
					.addStringOption((optBuilder) => optBuilder
						.setRequired(true)
						.setName('key')
						.setDescription('Config key to set'))
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
						.setDescription('Module to configure'))
					.addStringOption((optBuilder) => optBuilder
						.setRequired(true)
						.setName('key')
						.setDescription('Config key to get')));
		});
	}

	public async chatInputSet(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const module = interaction.options.getString('module', true);
		const key = interaction.options.getString('key', true);
		const value = interaction.options.getString('value', true);

		await interaction.deferReply({ ephemeral: true });

		await this.container.db.configValue.upsert({
			where: {
				guildId_module_key: {
					guildId: interaction.guildId,
					module,
					key,
				},
			},
			update: {
				value,
			},
			create: {
				guildId: interaction.guildId,
				module,
				key,
				value,
			},
		});

		await interaction.editReply('Updated!');
	}

	public async chatInputGet(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply('Not implemented yet');
	}
}
