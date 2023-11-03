import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'reason',
	description: 'Update the reason for a case',
	preconditions: ['ValidModerationConfigPrecondition'],
})
export class ReasonCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addIntegerOption((optBuilder) => optBuilder
				.setName('caseid')
				.setDescription('Case id to update')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Updated reason')
				.setRequired(true)
				.setMaxLength(1000)));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const caseId = interaction.options.getInteger('caseid', true);
		const reason = interaction.options.getString('reason', true);

		await interaction.deferReply();

		const logItem = await this.container.db.moderationLogItem.findFirst({
			where: {
				id: caseId,
				guildId: interaction.guildId,
			},
		});

		if (!logItem) {
			await interaction.editReply('No case found with that id.');
			return;
		}

		await this.container.retracedClient.reportEvent({
			action: 'moderation.reason',
			group: {
				id: interaction.guildId,
				name: interaction.guild!.name,
			},
			crud: 'u',
			actor: {
				id: interaction.user.id,
				name: interaction.user.tag,
			},
			target: {
				id: logItem.id.toString(),
				type: 'Case',
			},
			fields: {
				oldReason: logItem.reason,
				newReason: reason,
			},
		});

		await this.container.db.moderationLogItem.update({
			where: {
				id: caseId,
			},
			data: {
				reason,
			},
		});

		await interaction.editReply(`Updated reason for case ${caseId} to: ${reason}`);
	}
}
