import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	PermissionFlagsBits,
} from 'discord.js';
import parseDuration from 'parse-duration';

@ApplyOptions<Command.Options>({
	name: 'mute',
	description: 'Mute an user',
	preconditions: ['ValidModerationConfigPrecondition'],
})
export class MuteCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
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
			.addBooleanOption((optBuilder) => optBuilder
				.setName('silent')
				.setDescription("The bot won't notify the user if the mute is silent"))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('strike')
				.setDescription('Wil be recorded as a strike if true')));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);
		const reason = interaction.options.getString('reason', true);
		const durationString = interaction.options.getString('duration', true);
		const silent = interaction.options.getBoolean('silent', false) ?? false;
		const hardMute = interaction.options.getBoolean('force', true);
		const strike = interaction.options.getBoolean('strike', false) ?? false;

		const duration = parseDuration(durationString);

		if (!duration) {
			await interaction.reply({
				content: 'Given duration was invalid',
				ephemeral: true,
			});
			return;
		}

		await interaction.deferReply();

		// Try to find existing mute
		const existingMute = await this.container.db.activeMute.findUnique({
			where: {
				userId_guildId: {
					userId: user.id,
					guildId: interaction.guildId,
				},
			},
			include: {
				logItem: true,
			},
		});
		if (existingMute) {
			const oldMuteEndDate = existingMute.logItem.date.getTime() + existingMute.logItem.duration!;
			const newMuteEndDate = Date.now() + duration;

			if (oldMuteEndDate > newMuteEndDate) {
				await interaction.editReply('Cannot mute, new mute ends before existing mute.');
				return;
			}
		}

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
				action: 'MUTE',
				moderatorId: interaction.user.id,
				reason,
				duration,
				offenderId: user.id,
				guildId: interaction.guildId,
				silent,
				hardMute,
				strikes: strike ? 1 : undefined,
				messageId: reply.id,
				channelId: reply.channelId,
			},
		});

		const confirmEmbed = new EmbedBuilder()
			.setTitle(`Muting **${user.tag}**${silent ? ' silently' : ''} for ${this.container.humanizeDuration(duration)}`)
			.setDescription(`Reason: ${reason}`)
			.setTimestamp();

		const confirmButton = new ButtonBuilder()
			.setCustomId(`moderation:mute:confirm:${logItem.id}`)
			.setLabel('Confirm Mute')
			.setStyle(ButtonStyle.Danger);

		const cancelButton = new ButtonBuilder()
			.setCustomId(`moderation:mute:cancel:${logItem.id}`)
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
