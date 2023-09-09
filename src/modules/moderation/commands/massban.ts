import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import axios from 'axios';

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
				.setDescription('File with a list of all the users (only accepts .txt, see docs for format)')));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const reason = interaction.options.getString('reason', true);
		const list = interaction.options.getString('list');
		const file = interaction.options.getAttachment('file');

		if (!list && !file) {
			await interaction.reply('No ban list was provided.');
			return;
		}

		if (list && file) {
			await interaction.reply('Please specify only one of the two options');
			return;
		}

		let ids: string[] = [];
		if (list) {
			ids = list.split(/\s/g);
			await interaction.deferReply();
		}
		if (file) {
			if (file.contentType !== 'text/plain') {
				await interaction.reply('File type is invalid');
				return;
			}

			await interaction.deferReply();
			const res = await axios.get<string>(file.url);
			ids = res.data.replace(/\r/g, '').split(/\n+|\s+|,/g);
		}

		if (ids.length <= 1) {
			await interaction.editReply('List seems to be invalid, please try again.');
			return;
		}

		await interaction.editReply(`Banning ${ids.length} users, please wait...`);

		const massban = await this.container.db.massban.create({
			data: {
				reason,
				guildId: interaction.guildId,
				moderatorId: interaction.user.id,
				offenders: ids,
			},
		});

		await Promise.all(ids.map(async (id) => {
			await interaction.guild!.members.ban(id, { reason });
		}));

		// Create cross report button
		const reportButton = new ButtonBuilder()
			.setCustomId(`moderation:report-massban:${massban.id}`)
			.setLabel('Cross report')
			.setStyle(ButtonStyle.Danger);

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(reportButton);

		await interaction.editReply({
			content: 'Massban was successful!',
			components: [row],
		});

		const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
			where: {
				guildId: interaction.guildId,
			},
		});

		const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

		if (!logChannel) {
			this.container.logger.error(`Interaction[Handlers][Moderation][ban] Cannot find log channel (${guildConfig.logChannel}) in ${interaction.guildId}`);
			return;
		}

		if (logChannel.type !== ChannelType.GuildText) {
			this.container.logger.error(`Interaction[Handlers][Moderation][ban] Channel ${guildConfig.logChannel} is not text based?`);
			return;
		}

		const logEmbed = new EmbedBuilder()
			.setTitle(`massban | case ${massban.id}`)
			.setDescription(`**User count:** ${ids.length}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`)
			.setTimestamp()
			.setColor('#f54242');

		await logChannel.send({ embeds: [logEmbed] });
	}
}
