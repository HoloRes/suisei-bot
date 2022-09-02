import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';

@ApplyOptions<Subcommand.Options>({
	name: 'config',
	description: 'Update server settings',
	subcommands: [
		{
			name: 'set',
			chatInputRun: 'chatInputSet',
		},
		{
			name: 'get',
			chatInputRun: 'chatInputGet',
		},
	],
	preconditions: ['StaffOnly'],
})
export class ConfigCommand extends Subcommand {
	public async chatInputSet(interaction: Subcommand.ChatInputInteraction) {
		return interaction.reply('Not implemented yet');
	}

	public async chatInputGet(interaction: Subcommand.ChatInputInteraction) {
		return interaction.reply('Not implemented yet');
	}

	public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
		return interaction.respond([]);
	}
}
