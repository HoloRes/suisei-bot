import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'mute',
	description: 'Mute an user',
})
export class MuteCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to mute')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('duration')
				.setDescription('The duration to mute the user for, for example 3d 2h')
				.setRequired(true)
				.setMinLength(2)
				.setMaxLength(32))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the mute')
				.setRequired(true)
				.setMaxLength(1000))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('force')
				.setDescription('This will remove all other roles from the user until the mute expires')
				.setRequired(true))
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.reply('Not implemented yet.');
	}
}
