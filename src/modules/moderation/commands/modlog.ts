import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'modlog',
	description: 'Fetch the mod log of an user',
})
export class ModLogCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to check')
				.setRequired(true))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('crosscheck')
				.setDescription('Also list cases from other servers')
				.setRequired(true))
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.reply('Not implemented yet.');
	}
}
