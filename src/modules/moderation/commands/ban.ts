import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ButtonBuilder, EmbedBuilder, PermissionFlagsBits, ButtonStyle, ActionRowBuilder,
} from 'discord.js';
import parseDuration from 'parse-duration';

// TODO: Add message purge
@ApplyOptions<Command.Options>({
	name: 'ban',
	description: 'Ban an member',
	preconditions: ['ValidModerationConfig'],
})
export class BanCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to ban')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the ban')
				.setRequired(true)
				.setMaxLength(1000))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('silent')
				.setDescription("The bot won't notify the user if the ban is silent")
				.setRequired(true))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('strike')
				.setDescription('Wil be recorded as a strike if true'))
			.addStringOption((optBuilder) => optBuilder
				.setName('purge')
				.setDescription('Duration of messages to purge, for example 2d (max 7d)'))
			.addStringOption((optBuilder) => optBuilder
				.setName('duration')
				.setDescription('Duration of the ban, for example 3d 2h')
				.setMinLength(2)
				.setMaxLength(32)));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);
		const reason = interaction.options.getString('reason', true);
		const silent = interaction.options.getBoolean('silent', true);
		const strike = interaction.options.getBoolean('strike', false) ?? false;
		const durationString = interaction.options.getString('duration', false);
		const purgeString = interaction.options.getString('purge', false);
		let duration: number | undefined;
		let purgeDuration: number | undefined;

		if (durationString) {
			duration = parseDuration(durationString);
			if (!duration) {
				await interaction.reply('Invalid duration');
				return;
			}
		}
		if (purgeString) {
			purgeDuration = parseDuration(purgeString);
			if (!purgeDuration) {
				await interaction.reply('Invalid purge duration');
				return;
			}
			// Limit between 0 and 7 days
			purgeDuration = Math.min(Math.max(purgeDuration, 0), 7 * 24 * 60 * 60);
		}

		if (!duration && durationString) {
			await interaction.reply({
				content: 'Given duration was invalid',
				ephemeral: true,
			});
			return;
		}

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

		const reply = await interaction.fetchReply();

		const logItem = await this.container.db.moderationPendingLogItem.create({
			data: {
				type: 'MANUAL',
				action: 'BAN',
				moderatorId: interaction.user.id,
				reason,
				duration,
				purgeDuration,
				offenderId: user.id,
				guildId: interaction.guildId,
				silent,
				strikes: strike ? 1 : undefined,
				messageId: reply.id,
				channelId: reply.channelId,
			},
		});

		const confirmEmbed = new EmbedBuilder()
			.setTitle(`Banning **${user.tag}**${silent ? ' silently' : ''}${duration ? ` for ${this.container.humanizeDuration(duration)}` : ''}`)
			.setDescription(`Reason: ${reason}`)
			.setTimestamp();

		const confirmButton = new ButtonBuilder()
			.setCustomId(`moderation:ban:confirm:${logItem.id}`)
			.setLabel('Confirm Ban')
			.setStyle(ButtonStyle.Danger);

		const cancelButton = new ButtonBuilder()
			.setCustomId(`moderation:ban:cancel:${logItem.id}`)
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
