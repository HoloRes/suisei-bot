import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'warn',
	description: 'Warn an user',
})
export class WarnCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to unban')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the unban')
				.setRequired(true)
				.setMaxLength(1000)));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.reply('Not implemented yet.');

		/* eslint-disable */
		/*
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);
		const reason = interaction.options.getString('reason', true);

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

		// Find the guild config
		const guildConfig = await this.container.db.moderationGuildConfig.findUnique({
			where: {
				guildId: interaction.guildId,
			},
		});
		if (!guildConfig) {
			await interaction.editReply('Something went wrong, please try again.');
			return;
		}

		// Log action to modlog channel
		const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

		if (!logChannel) {
			this.container.logger.error(`Interaction[Commands][Moderation][unmute] Cannot find log channel (${guildConfig.logChannel}) in ${interaction.guildId}`);
			return;
		}

		if (logChannel.type !== ChannelType.GuildText) {
			this.container.logger.error(`Interaction[Commands][Moderation][unmute] Channel ${guildConfig.logChannel} is not text based?`);
			return;
		}

		// Create a new log item
		const logItem = await this.container.db.moderationLogItem.create({
			data: {
				type: 'MANUAL',
				action: 'UNBAN',
				moderatorId: interaction.user.id,
				reason,
				offenderId: user.id,
				guildId: interaction.guildId,
				affectedCaseId: activeMute.logItem.id,
				...(revokeStrike ? ({
					strikes: -1,
					strikeDate: activeMute.logItem.strikeDate,
				}) : {}),
			},
		});

		const logEmbed = new EmbedBuilder()
			.setTitle(`unmute | case ${logItem.id}`)
			.setDescription(`**Offender:** ${offenderUser.tag} (<@${offenderUser.id}>)\n**Reason:** ${reason}`)
			.setFooter({ text: `Affects: ${activeMute.logItem.id}` })
			.setTimestamp()
			.setColor('#2bad63');
		*/
	}
}
