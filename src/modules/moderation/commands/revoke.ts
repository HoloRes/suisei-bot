import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'revoke',
	description: 'Revoke a strike',
})
export class RevokeCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.addIntegerOption((optBuilder) => optBuilder
				.setName('caseid')
				.setDescription('Case id to revoke')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the revocation')
				.setRequired(true)
				.setMaxLength(1000))
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.reply('Not implemented yet.');
	}
}
