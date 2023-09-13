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
		const moderatorId = data[4];

		const moderator = await this.container.client.users.fetch(moderatorId);

		const noteField = interaction.fields.getField('note', ComponentType.TextInput);

		if (action === 'create') {
			const note = await this.container.db.note.create({
				data: {
					note: noteField.value,
					userId: noteIdOrUserId,
					guildId: interaction.guildId!,
				},
			});

			await this.container.retracedClient.reportEvent({
				action: 'moderation.note.create',
				group: {
					id: interaction.guildId!,
					name: interaction.guild!.name,
				},
				crud: 'c',
				actor: {
					id: moderator.id,
					name: moderator.tag,
				},
				target: {
					id: noteIdOrUserId,
					type: 'User',
				},
				fields: {
					noteId: note.id.toString(),
				},
			});

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
					note: noteField.value,
				},
			});

			await this.container.retracedClient.reportEvent({
				action: 'moderation.note.update',
				group: {
					id: interaction.guildId!,
					name: interaction.guild!.name,
				},
				crud: 'u',
				actor: {
					id: moderator.id,
					name: moderator.tag,
				},
				target: {
					id: noteIdOrUserId,
					type: 'Note',
				},
				fields: {
					noteId: noteIdOrUserId,
				},
			});

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
