import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ChannelType, EmbedBuilder, Message, PermissionFlagsBits, TextChannel,
} from 'discord.js';
import {
	ModerationAction,
	ModerationGuildConfig,
	ModerationType,
} from '#src/generated/prisma/client';

@ApplyOptions<ListenerOptions>({ event: Events.MessageCreate })
export class BanBlackholeListener extends Listener<typeof Events.MessageCreate> {
	private async mute(message: Message, logChannel: TextChannel, guildConfig: ModerationGuildConfig) {
		const logItem = await this.container.db.moderationLogItem.create({
			data: {
				type: ModerationType.AUTOMOD,
				action: ModerationAction.MUTE,
				guildId: message.guildId!,
				moderatorId: this.container.client.id!,
				offenderId: message.author.id,
				reason: `Posted in a blackhole channel (<#${message.channelId}>)`,
			},
		});

		let notifyFailed = false;
		const notificationEmbed = new EmbedBuilder()
			.setTitle(`You've been automatically muted in: ${message.guild!.name}`)
			.setDescription('Reason: You were warned to not post in that channel.')
			.setTimestamp();

		try {
			await message.author.send({ embeds: [notificationEmbed] });
		} catch {
			notifyFailed = true;
		}

		try {
			await this.container.db.activeMute.upsert({
				where: {
					userId_guildId: {
						guildId: message.guildId!,
						userId: message.author.id,
					},
				},
				create: {
					guildId: message.guildId!,
					userId: message.author.id,
					logItemId: logItem.id,
				},
				update: {
					logItemId: logItem.id,
				},
			});

			await message.member!.roles.add(guildConfig.muteRole, `Mute ${logItem.id}, reason: ${logItem.reason}`);
		} catch (e) {
			this.container.logger.error(e);

			const failedLogEmbed = new EmbedBuilder()
				.setTitle(`[FAILED] automatic mute | case ${logItem.id}`)
				.setDescription(`**Offender:** ${message.author.tag} (<@${message.author.id}>)\n**Reason:** ${logItem.reason}\n**Duration:** Permanent${notifyFailed ? '\nFailed to send DM notification' : ''}`)
				.setFooter({ text: `ID: ${message.author.id}` })
				.setTimestamp()
				.setColor('#f54242');

			await logChannel.send({ embeds: [failedLogEmbed] });
			return;
		}

		const logEmbed = new EmbedBuilder()
			.setTitle(`automatic mute | case ${logItem.id}`)
			.setDescription(`**Offender:** ${message.author.tag} (<@${message.author.id}>)\n**Reason:** ${logItem.reason}\n**Duration:** Permanent${notifyFailed ? '\nFailed to send DM notification' : ''}`)
			.setFooter({ text: `ID: ${message.author.id}` })
			.setTimestamp()
			.setColor('#ff9d24');

		await logChannel.send({ embeds: [logEmbed] });
	}

	private async ban(message: Message, logChannel: TextChannel) {
		const logItem = await this.container.db.moderationLogItem.create({
			data: {
				type: ModerationType.AUTOMOD,
				action: ModerationAction.BAN,
				guildId: message.guildId!,
				moderatorId: this.container.client.id!,
				offenderId: message.author.id,
				reason: `Posted in a blackhole channel (<#${message.channelId}>)`,
			},
		});

		let notifyFailed = false;
		const notificationEmbed = new EmbedBuilder()
			.setTitle(`You've been automatically banned from: ${message.guild!.name}`)
			.setDescription('Reason: You were warned to not post in that channel.')
			.setTimestamp();

		try {
			await message.author.send({ embeds: [notificationEmbed] });
		} catch {
			notifyFailed = true;
		}

		try {
			await message.member!.ban({ reason: logItem.reason });
		} catch (e) {
			this.container.logger.error(e);

			const failedLogEmbed = new EmbedBuilder()
				.setTitle(`[FAILED] automatic ban | case ${logItem.id}`)
				.setDescription(`**Offender:** ${message.author.tag} (<@${message.author.id}>)\n**Reason:** ${logItem.reason}\n**Duration:** Permanent${notifyFailed ? '\nFailed to send DM notification' : ''}`)
				.setFooter({ text: `ID: ${message.author.id}` })
				.setTimestamp()
				.setColor('#f54242');

			await logChannel.send({ embeds: [failedLogEmbed] });
			return;
		}

		const logEmbed = new EmbedBuilder()
			.setTitle(`automatic ban | case ${logItem.id}`)
			.setDescription(`**Offender:** ${message.author.tag} (<@${message.author.id}>)\n**Reason:** ${logItem.reason}\n**Duration:** Permanent${notifyFailed ? '\nFailed to send DM notification' : ''}`)
			.setFooter({ text: `ID: ${message.author.id}` })
			.setTimestamp()
			.setColor('#f54242');

		await logChannel.send({ embeds: [logEmbed] });
	}

	public override async run(message: Message) {
		// Ignore if not in a Guild
		if (!message.inGuild()) return;

		const blackholeChannels = await this.container.db.configValue.findFirst({
			where: {
				guildId: message.guildId,
				module: 'moderation',
				key: 'blackholeChannels',
			},
		});

		// Check if is in blackhole channel
		if (
			!blackholeChannels
			|| !blackholeChannels.value.split(',')
				.map((id) => id.trim())
				.includes(message.channelId)
		) {
			return;
		}
		// Ignore if moderator
		if (message.member!.permissions.has(PermissionFlagsBits.ManageMessages, true)) return;

		// Delete message
		await message.delete();

		// Ignore bots
		if (message.author.bot) return;

		await this.container.db.moderationUser.upsert({
			where: {
				id: message.author.id,
			},
			create: {
				id: message.author.id,
				lastKnownTag: message.author.tag,
			},
			update: {
				lastKnownTag: message.author.tag,
			},
		});

		const blackholeConfig = await this.container.db.configValue.findFirst({
			where: {
				guildId: message.guildId,
				module: 'moderation',
				key: `blackholeChannels.${message.channelId}.method`,
			},
		});

		// Log to modlog channel
		const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
			where: {
				guildId: message.guildId,
			},
		});

		const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

		if (!logChannel) {
			this.container.logger.error(`Listeners[Moderation][blackhole] Cannot find log channel (${guildConfig.logChannel}) in ${message.guildId}`);
			return;
		}

		if (logChannel.type !== ChannelType.GuildText) {
			this.container.logger.error(`Listeners[Moderation][blackhole] Log channel ${guildConfig.logChannel} is not text based?`);
			return;
		}

		switch (blackholeConfig?.value ?? 'ban') {
			case 'containsTrigger': {
				const triggerConfig = await this.container.db.configValue.findFirst({
					where: {
						guildId: message.guildId,
						module: 'moderation',
						key: `blackholeChannels.${message.channelId}.trigger`,
					},
				});

				if (!triggerConfig) {
					await this.mute(message, logChannel, guildConfig);
				} else if (message.cleanContent.toLowerCase()
					.includes(triggerConfig.value)) {
					await this.ban(message, logChannel);
				} else {
					await this.mute(message, logChannel, guildConfig);
				}
				break;
			}
			case 'mute': {
				await this.mute(message, logChannel, guildConfig);
				break;
			}
			case 'log': {
				const logEmbed = new EmbedBuilder()
					.setTitle('notification | post in blackhole channel')
				// eslint-disable-next-line @stylistic/max-len
					.setDescription(`**Offender:** ${message.author.tag} (<@${message.author.id}>)\n**Reason:** Posted in blackhole channel <#${message.channelId}>`)
					.setFooter({ text: `ID: ${message.author.id}` })
					.setTimestamp()
					.setColor('#24c5ff');

				await logChannel.send({ embeds: [logEmbed] });
				break;
			}
			case 'ban':
			default: {
				await this.ban(message, logChannel);
				break;
			}
		}
	}
}
