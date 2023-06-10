import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
	public async run(interaction: ButtonInteraction) {
		await interaction.deferReply();
		await interaction.message.edit({ embeds: interaction.message.embeds });

		const data = interaction.customId.split(':');
		const action = data[2];
		const id = data[3];

		const pendingItem = await this.container.db.moderationPendingLogItem.delete({
			where: {
				id,
			},
		});

		if (action === 'cancel') {
			await interaction.editReply('Ban has been cancelled.');
		} else {
			// Must be 'confirm'
			await interaction.editReply('Banning, please wait...');
			await this.container.db.moderationLogItem.create({
				data: {
					type: pendingItem.type,
					reason: pendingItem.reason,
					moderator: pendingItem.moderator,
					duration: pendingItem.duration,
					userId: pendingItem.userId,
					guildId: pendingItem.guildId,
				},
			});

			const user = await this.container.client.users.fetch(pendingItem.userId);

			let notifyFailed = false;
			if (!pendingItem.silent) {
				const notificationEmbed = new EmbedBuilder()
					.setTitle(`Ban in ${interaction.guild!.name}`)
					.setDescription(`You have been banned for: ${pendingItem.reason}`)
					.setTimestamp();

				try {
					// TODO: add button with link to appeal site
					await user.send({ embeds: [notificationEmbed] });
				} catch {
					notifyFailed = true;
				}
			}

			// TODO: log item to text channel
			// TODO: in case of temp ban, schedule unban
			try {
				await interaction.guild!.members.ban(pendingItem.userId);
				await interaction.editReply(`Banned ${user.tag}${notifyFailed ? ', but failed to send DM notification' : ''}`);
			} catch {
				await interaction.editReply(`Failed to ban ${user.tag}`);
			}
		}
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('moderation:ban')) return this.none();
		if (!interaction.inGuild()) return this.none();

		return this.some();
	}
}
