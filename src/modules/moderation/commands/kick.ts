import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'kick',
	description: 'Kick an member',
})
export class KickCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to kick')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the kick')
				.setRequired(true)
				.setMaxLength(1000))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('silent')
				.setDescription("The bot won't notify the user if the kick is silent")
				.setRequired(true))
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);
		/* eslint-disable */
		const reason = interaction.options.getString('reason', true);
		const silent = interaction.options.getBoolean('silent', true);
		/* eslint-enable */

		await interaction.deferReply();

		await this.container.db.moderationUser.upsert({
			where: {
				id: user.id,
			},
			create: {
				id: user.id,
				lastKnownTag: user.tag,
			},
			update: {
				lastKnownTag: user.tag,
			},
		});

		await interaction.editReply('Not implemented yet.');
	}
}
