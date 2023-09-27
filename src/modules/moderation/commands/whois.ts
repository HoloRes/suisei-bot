import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'whois',
	description: 'Get info about an user',
})
export class ModLogCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to check')
				.setRequired(true))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('crosscheck')
				.setDescription('Also show stats of this user from other servers')
				.setRequired(true)));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);
		const crosscheck = interaction.options.getBoolean('crosscheck', true);

		await interaction.deferReply();

		const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
			where: {
				guildId: interaction.guildId,
			},
		});

		const strikes = await this.container.db.moderationLogItem.findMany({
			where: {
				offenderId: user.id,
				guildId: crosscheck ? undefined : interaction.guildId,
			},
			select: {
				guildId: true,
				strikes: true,
				date: true,
			},
		});

		let strikesInGuild = strikes;

		if (crosscheck) {
			strikesInGuild = strikes.filter((logItem) => logItem.guildId === interaction.guildId);
		}

		const strikesInGuildTotal = strikesInGuild
			.reduce((accumulator, logItem) => accumulator + logItem.strikes!, 0);
		const strikesInGuildActive = strikesInGuild
			.filter((logItem) => Date.now() - logItem.date.getTime() > guildConfig.strikeExpiresAfter)
			.reduce((accumulator, logItem) => accumulator + logItem.strikes!, 0);

		let member;
		try {
			member = await interaction.guild!.members.fetch(user.id);
		} catch { /* */ }

		const infoEmbed = new EmbedBuilder()
			.setAuthor({
				name: user.tag,
				iconURL: user.avatarURL() ?? user.defaultAvatarURL,
			})
			.setDescription(`<@${user.id}>`)
			.addFields(
				{
					name: 'Joined',
					value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}>` : 'Not a member',
					inline: true,
				},
				{
					name: '\u200b',
					value: '\u200b',
					inline: true,
				},
				{
					name: 'Registered',
					value: `<t:${Math.floor(user.createdTimestamp / 1000)}>`,
					inline: true,
				},
				{
					name: 'Active strikes',
					value: `${strikesInGuildActive}`,
					inline: true,
				},
				{
					name: '\u200b',
					value: '\u200b',
					inline: true,
				},
				{
					name: 'Total strikes',
					value: `${strikesInGuildTotal}`,
					inline: true,
				},
			)
			.setThumbnail(user.avatarURL() ?? user.defaultAvatarURL)
			.setFooter({ text: `ID: ${user.id}` })
			.setColor('#61cdff')
			.setTimestamp();

		if (crosscheck) {
			const strikesTotal = strikes
				.reduce((accumulator, logItem) => accumulator + logItem.strikes!, 0);
			const strikesActive = strikes
				.filter((logItem) => Date.now() - logItem.date.getTime() > guildConfig.strikeExpiresAfter)
				.reduce((accumulator, logItem) => accumulator + logItem.strikes!, 0);

			infoEmbed.addFields(
				{
					name: 'Active strikes globally',
					value: `${strikesActive}`,
					inline: true,
				},
				{
					name: '\u200b',
					value: '\u200b',
					inline: true,
				},
				{
					name: 'Total strikes globally',
					value: `${strikesTotal}`,
					inline: true,
				},
			);
		}

		const userReports = await this.container.bansApi.users.findByUserId(user.id);
		const banLists = await this.container.bansApi.userBanLists.findUser(user.id);
		if (userReports.length > 0) {
			infoEmbed
				.setColor('#f54242')
				.setTitle(`Found ${userReports.length} reports!`);
		}
		if (banLists.length > 0) {
			infoEmbed
				.setColor('#f54242')
				.setTitle(`${userReports.length > 0 ? `Found ${userReports.length} reports!\n` : ''}Found user in ${banLists.length} ban lists!`);
		}

		await interaction.editReply({
			embeds: [infoEmbed],
		});
	}
}
