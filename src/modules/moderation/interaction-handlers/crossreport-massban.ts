import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ButtonInteraction } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class CrossReportMassbanButtonHandler extends InteractionHandler {
	public async run(interaction: ButtonInteraction) {
		await interaction.deferReply();

		const data = interaction.customId.split(':');
		const id = data[2];

		const item = await this.container.db.massban.findUniqueOrThrow({
			where: {
				id: Number.parseInt(id, 10),
			},
		});

		const report = await this.container.bansApi.userBanLists.create({
			users: item.offenders,
			moderatorId: item.moderatorId,
			reason: item.reason,
		});

		await interaction.editReply({
			content: `Successfully reported, id: ${report.id}`,
			components: [],
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('moderation:report-massban')) return this.none();
		if (!interaction.inGuild()) return this.none();

		return this.some();
	}
}
