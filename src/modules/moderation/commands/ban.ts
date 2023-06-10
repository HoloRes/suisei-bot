import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ButtonBuilder, EmbedBuilder, PermissionFlagsBits, ButtonStyle, ActionRowBuilder,
} from 'discord.js';
import parseDuration from 'parse-duration';

@ApplyOptions<Command.Options>({
	name: 'ban',
	description: 'Ban an member',
})
export class BanCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
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
			.addStringOption((optBuilder) => optBuilder
				.setName('duration')
				.setDescription('Duration of the ban, for example 3d 2h')
				.setMinLength(2)
				.setMaxLength(32))
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);
		const reason = interaction.options.getString('reason', true);
		const silent = interaction.options.getBoolean('silent', true);
		const durationString = interaction.options.getString('duration', false);
		let duration: number | undefined;

		if (durationString) {
			duration = parseDuration(durationString);
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

		const logItem = await this.container.db.moderationPendingLogItem.create({
			data: {
				type: 'BAN',
				moderator: interaction.user.id,
				reason,
				duration,
				userId: user.id,
				guildId: interaction.guildId,
				silent,
			},
		});

		const confirmEmbed = new EmbedBuilder()
			.setTitle(`Banning **${user.tag}**${silent ? ' silently' : ''}${duration ? ` for ${this.container.humanizeDuration(duration)}` : ''}`)
			.setDescription(`Reason: ${reason}`)
			.setTimestamp();

		const confirmButton = new ButtonBuilder()
			.setCustomId(`moderation:confirm:cancel:${logItem.id}`)
			.setLabel('Confirm Ban')
			.setStyle(ButtonStyle.Danger);

		const cancelButton = new ButtonBuilder()
			.setCustomId(`moderation:ban:cancel:${logItem.id}`)
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder()
			.addComponents(cancelButton, confirmButton);

		await interaction.editReply({
			embeds: [confirmEmbed],
			// TODO
			// @ts-ignore
			components: [row],
		});
	}
}
