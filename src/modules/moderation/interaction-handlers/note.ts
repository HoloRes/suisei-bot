import { InteractionHandler, InteractionHandlerTypes, PieceContext } from '@sapphire/framework';
import { ComponentType, ModalSubmitInteraction } from 'discord.js';

export class NoteModalHandler extends InteractionHandler {
	public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
		});
	}

	public async run(interaction: ModalSubmitInteraction) {
		const data = interaction.customId.split(':');
		const action = data[2];
		const noteIdOrUserId = data[3];
		// const moderatorId = data[4];

		const note = interaction.fields.getField('note', ComponentType.TextInput);

		if (action === 'create') {
			await this.container.db.note.create({
				data: {
					note: note.value,
					userId: noteIdOrUserId,
					guildId: interaction.guildId!,
				},
			});

			// TODO: Add audit log item

			await interaction.reply({
				content: 'Note successfully created.',
				ephemeral: true,
			});
		} else {
			// Must be edit
			await this.container.db.note.update({
				where: {
					id: Number.parseInt(noteIdOrUserId, 10),
				},
				data: {
					note: note.value,
				},
			});

			// TODO: Add audit log item

			await interaction.reply({
				content: 'Note successfully updated.',
				ephemeral: true,
			});
		}
	}

	public override parse(interaction: ModalSubmitInteraction) {
		if (!interaction.customId.startsWith('moderation:note')) return this.none();

		return this.some();
	}
}
