import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ButtonInteraction,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ComponentType,
} from 'discord.js';
import type { UserReportType } from '@holores/bansapi.js/dist/types';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class CrossReportButtonHandler extends InteractionHandler {
	public async run(interaction: ButtonInteraction) {
		await interaction.deferReply();

		const reply = await interaction.fetchReply();

		const data = interaction.customId.split(':');
		const id = data[2];

		const typeSelect = new StringSelectMenuBuilder()
			.setCustomId('type')
			.setPlaceholder('Choose a report type')
			.addOptions(
				new StringSelectMenuOptionBuilder()
					.setValue('NORMAL')
					.setLabel('Normal')
					.setDescription('A normal ban'),
				new StringSelectMenuOptionBuilder()
					.setValue('COMPROMISED')
					.setLabel('Compromised')
					.setDescription('A compromised account'),
			);

		const row = new ActionRowBuilder<StringSelectMenuBuilder>()
			.addComponents(typeSelect);

		const followUp = await interaction.followUp({
			components: [row],
		});

		let type;
		try {
			type = await followUp.awaitMessageComponent({
				componentType: ComponentType.StringSelect,
				time: 900_000,
			});
		} catch {
			await followUp.edit({ content: 'Confirmation not received within 15 minutes, cancelling', components: [] });
			return;
		}

		const logItem = await this.container.db.moderationLogItem.findUniqueOrThrow({
			where: {
				id: Number.parseInt(id, 10),
			},
		});

		const report = await this.container.bansApi.users.create({
			userId: logItem.offenderId,
			moderatorId: logItem.moderatorId,
			reason: logItem.reason,
			type: type.values[0] as UserReportType,
		});

		await this.container.retracedClient.reportEvent({
			action: 'moderation.crossreport.user',
			group: {
				id: interaction.guildId!,
				name: interaction.guild!.name,
			},
			crud: 'c',
			actor: {
				id: interaction.user.id,
				name: interaction.user.tag,
			},
			target: {
				id: logItem.offenderId,
				type: 'User',
			},
			fields: {
				logItemId: logItem.id.toString(),
				reportId: report.id.toString(),
			},
		});

		await interaction.editReply({
			content: reply.content,
			components: [],
		});

		await followUp.edit({
			content: `Successfully reported, id: ${report.id}`,
			components: [],
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('moderation:report')) return this.none();
		if (!interaction.inGuild()) return this.none();

		return this.some();
	}
}
