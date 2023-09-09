import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { GuildMember } from 'discord.js';

@ApplyOptions<ListenerOptions>({ event: Events.GuildMemberAdd })
export class GuildMemberAddListener extends Listener<typeof Events.GuildMemberAdd> {
	public override async run(member: GuildMember) {
		const activeMute = await this.container.db.activeMute.findUnique({
			where: {
				userId_guildId: {
					userId: member.id,
					guildId: member.guild.id,
				},
			},
		});

		if (!activeMute) return;

		const guildConfig = await this.container.db.moderationGuildConfig.findUnique({
			where: {
				guildId: member.guild.id,
			},
		});
		if (!guildConfig) {
			this.container.logger.error(`Listeners[Moderation][guildMemberAdd] Failed to fetch guild config to re-apply mute for log item ${activeMute.logItemId}`);
			return;
		}

		if (activeMute.hardMuteId) {
			await member.roles.set([guildConfig.muteRole], `Hard mute ${activeMute.logItemId}, reason: automatically re-applying mute after rejoin`);
		} else {
			await member.roles.add(guildConfig.muteRole, `Hard mute ${activeMute.logItemId}, reason: automatically re-applying mute after rejoin`);
		}

		// TODO: Maybe log to modlog?
	}
}
