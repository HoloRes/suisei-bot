import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	PermissionFlagsBits,
} from 'discord.js';

interface StrikeAction {
	action: 'WARN' | 'MUTE' | 'KICK' | 'BAN';
	duration?: number;
}

@ApplyOptions<Command.Options>({
	name: 'strike',
	description: 'Strike an user',
	preconditions: ['ValidModerationConfig'],
})
export class StrikeCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to strike')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the strike')
				.setRequired(true)
				.setMaxLength(1000)));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
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

		const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
			where: {
				guildId: interaction.guildId,
			},
		});

		const strikes = await this.container.db.moderationLogItem.findMany({
			where: {
				offenderId: user.id,
				strikes: {
					not: 0,
				},
				strikeDate: {
					gte: new Date(Date.now() - guildConfig.strikeExpiresAfter * 1000),
				},
			},
			select: {
				strikes: true,
			},
		});
		const actionIndex = Math.min(
			strikes.reduce((count, logItem) => count + logItem.strikes!, 0),
			(guildConfig.strikes! as unknown as StrikeAction[]).length - 1,
		);

		const action = (guildConfig.strikes! as unknown as StrikeAction[])[actionIndex];

		const reply = await interaction.fetchReply();

		const logItem = await this.container.db.moderationPendingLogItem.create({
			data: {
				type: 'STRIKE',
				action: action.action,
				moderatorId: interaction.user.id,
				reason,
				duration: action.duration ? action.duration * 1000 : undefined,
				offenderId: user.id,
				guildId: interaction.guildId,
				strikes: 1,
				messageId: reply.id,
				channelId: reply.channelId,
			},
		});

		const confirmEmbed = new EmbedBuilder()
			.setTitle(`Striking **${user.tag}**`)
			.setDescription(`Reason: ${reason}`)
			.setTimestamp();

		const confirmButton = new ButtonBuilder()
			.setCustomId(`moderation:strike:confirm:${logItem.id}`)
			.setLabel('Confirm Strike')
			.setStyle(ButtonStyle.Danger);

		const cancelButton = new ButtonBuilder()
			.setCustomId(`moderation:strike:cancel:${logItem.id}`)
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(cancelButton, confirmButton);

		await interaction.editReply({
			embeds: [confirmEmbed],
			components: [row],
		});

		await this.container.tasks.create('expirePendingModAction', { id: logItem.id }, 900_000);
	}
}
