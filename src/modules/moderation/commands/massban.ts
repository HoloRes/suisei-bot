import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'massban',
	description: 'Massban users',
})
export class MassbanCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the massban')
				.setRequired(true)
				.setMaxLength(1000))
			.addStringOption((optBuilder) => optBuilder
				.setName('list')
				.setDescription('List of all the users to ban'))
			.addAttachmentOption((optBuilder) => optBuilder
				.setName('file')
				.setDescription('File with a list of all the users (only accepts .txt)')));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.reply('Not implemented yet.');
	}
}
