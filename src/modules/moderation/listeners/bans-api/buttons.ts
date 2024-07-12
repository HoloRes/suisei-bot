import { container, Listener, ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import discord_js_1, { Interaction } from 'discord.js';

@ApplyOptions<ListenerOptions>({ event: 'interactionCreate' })
export class ButtonListener extends Listener {
	public override async run(interaction: Interaction) {
		// determine if this is a button
		if (!interaction.isButton()) return;
		if (!interaction.guild) return;
		if (!interaction.guildId) return;

		if (interaction.customId === 'ignore') {
			void interaction.message.edit({ components: [] });
			console.log('report ignored');
		} else if (interaction.customId.startsWith('kick')) {
			const [_, caseId, moderatorId, userId, reason] = interaction.customId.split(':');

			const user = await container.client.users.fetch(userId).catch(() => null);
			const moderator = await container.client.users.fetch(moderatorId).catch(() => null);
			if (!moderator) return;

			if (!user) return;

			try {
				void interaction.guild.members.kick(userId, reason);
				void interaction.message.edit({ components: [], content: 'User kicked' });
			} catch (e: any) {
				void interaction.message.edit({ components: [], content: `Could not kick user. Error: ${e}` });
				return;
			}

			// Notify the user
			// TODO: Allow silent kicks/bans maybe?
			const notificationEmbed = new discord_js_1.EmbedBuilder()
				.setTitle(`You've been kicked from: ${interaction.guild.name}`)
				.setDescription(`Reason: ${reason}`)
				.setTimestamp();
			try {
				// TODO: add button with link to appeal site
				await user.send({ embeds: [notificationEmbed] });
			} catch (e) {
				console.log('Could not dm', user.tag, e);
			}

			// Logging

			await this.container.retracedClient.reportEvent({
				action: 'moderation.kick',
				group: {
					id: interaction.guildId,
					name: interaction.guild.name,
				},
				crud: 'c',
				actor: {
					id: moderatorId,
					name: moderator.tag,
				},
				target: {
					id: userId,
					name: user.tag,
					type: 'User',
				},
				created: new Date(),
				fields: {
					logItemId: caseId,
				},
			});

			// Log to modlog channel
			const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
				where: {
					guildId: interaction.guildId,
				},
			});
			const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);
			if (!logChannel) {
				this.container.logger.error(`Interaction[Handlers][Moderation][kick] Cannot find log channel (${guildConfig.logChannel}) in ${interaction.guildId}`);
				return;
			}
			if (logChannel.type !== discord_js_1.ChannelType.GuildText) {
				this.container.logger.error(`Interaction[Handlers][Moderation][kick] Channel ${guildConfig.logChannel} is not text based?`);
				return;
			}
			const logEmbed = new discord_js_1.EmbedBuilder()
				.setTitle(`kick | case ${caseId}`)
				.setDescription(`**Offender:** ${user.tag} (<@${userId}>)\n**Reason:** ${reason}\n**Moderator:** ${moderator.tag}`)
				.setFooter({ text: `ID: ${userId}` })
				.setTimestamp()
				.setColor('#f54242');
			await logChannel.send({ embeds: [logEmbed] });
		} else if (interaction.customId.startsWith('ban')) {
			const [_, caseId, moderatorId, userId, reason] = interaction.customId.split(':');

			const user = await container.client.users.fetch(userId).catch(() => null);
			const moderator = await container.client.users.fetch(moderatorId).catch(() => null);

			if (!user) return;
			if (!moderator) return;

			try {
				void interaction.guild.bans.create(userId, { reason });
				void interaction.message.edit({ components: [], content: 'User banned' });
			} catch (e) {
				void interaction.message.edit({ components: [], content: `Could not ban user. Error: ${e}` });
				return;
			}

			// Notify the user
			// TODO: Allow silent kicks/bans maybe?
			const notificationEmbed = new discord_js_1.EmbedBuilder()
				.setTitle(`You've been banned from: ${interaction.guild.name}`)
				.setDescription(`Reason: ${reason}`)
				.setTimestamp();
			try {
				// TODO: add button with link to appeal site
				await user.send({ embeds: [notificationEmbed] });
			} catch (e) {
				console.log('Could not dm ', user.tag, e);
			}

			// Logging

			await this.container.retracedClient.reportEvent({
				action: 'moderation.ban',
				group: {
					id: interaction.guildId,
					name: interaction.guild.name,
				},
				crud: 'c',
				actor: {
					id: moderatorId,
					name: moderator.tag,
				},
				target: {
					id: userId,
					name: user.tag,
					type: 'User',
				},
				created: new Date(),
				fields: {
					logItemId: caseId,
				},
			});

			// Log to modlog channel
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
			if (logChannel.type !== discord_js_1.ChannelType.GuildText) {
				this.container.logger.error(`Interaction[Handlers][Moderation][ban] Channel ${guildConfig.logChannel} is not text based?`);
				return;
			}
			const logEmbed = new discord_js_1.EmbedBuilder()
				.setTitle(`ban | case ${caseId}`)
				.setDescription(`**Offender:** ${user.tag} (<@${userId}>)\n**Reason:** ${reason}\n**Moderator:** ${moderator.tag}`)
				.setFooter({ text: `ID: ${userId}` })
				.setTimestamp()
				.setColor('#f54242');
			await logChannel.send({ embeds: [logEmbed] });
		}
	}
}
