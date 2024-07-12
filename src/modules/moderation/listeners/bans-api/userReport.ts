import {container, Events, Listener, ListenerOptions} from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder} from 'discord.js';

@ApplyOptions<ListenerOptions>({ emitter: container.bansApi.amqpHandler, event: 'user' })
export class UserReportListener extends Listener {
	public override async run(report: any) {
		console.log('User reported. ', report);

		const embed = new EmbedBuilder()
			.setTitle(`Cross report #${report.data.id}`)
			.setDescription(
				`${report.data.moderator.lastKnownUsername} reported ${report.data.user.lastKnownUsername} for ${report.data.reason}`,
			);

		const buttons: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setLabel('ignore')
					.setStyle(ButtonStyle.Primary)
					.setCustomId('ignore'),
				new ButtonBuilder()
					.setLabel('kick')
					.setStyle(ButtonStyle.Secondary)
					.setCustomId(`kick:${report.data.id}:${report.data.moderatorId}:${report.data.userId}:${report.data.reason}`),
				new ButtonBuilder()
					.setLabel('ban')
					.setStyle(ButtonStyle.Danger)
					.setCustomId(`ban:${report.data.id}:${report.data.moderatorId}:${report.data.userId}:${report.data.reason}`),
			);

		const guildConfigs: any = await this.container.db.moderationGuildConfig.findMany();
		const guilds = await this.container.client.guilds.fetch({});
		guildConfigs.forEach(({ crossreportLogChannel, guildId }) => {
			console.log('sending to ', guildId, ' / ', crossreportLogChannel);
			if (crossreportLogChannel) {
				void guilds.get(guildId)?.fetch()?.then((guild) => {
					const channel = guild.channels.cache.get(crossreportLogChannel);
					console.log(channel);
					if (channel && channel.type === ChannelType.GuildText) {
						void channel.send({ embeds: [embed], components: [buttons] });
					}
				});
			}
		});
	}
}
