import { IModuleConfig, Module } from '@suiseis-mic/sapphire-modules';
import { assertEquals } from 'typescript-is';

export type ModerationModuleConfig = IModuleConfig;

export class ModerationModule extends Module<ModerationModuleConfig> {
	name = 'moderation';

	validConfig(): boolean {
		try {
			assertEquals<ModerationModuleConfig>(this.config);
			return true;
		} catch (error) {
			return false;
		}
	}
}
