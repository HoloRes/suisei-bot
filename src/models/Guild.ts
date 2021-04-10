// Packages
import mongoose, { Schema, Document } from 'mongoose';

// Types
import { IConfig } from '../types';

// Local files
const config: IConfig = require('../../config');

export interface IGuild extends Document {
	_id: string,
	settings: {
		prefix: string,
		enabledModules: string[],
	}
}

const GuildSchema: Schema = new Schema({
	_id: { type: String, required: true },
	settings: {
		prefix: { type: String, default: config.discord.defaultPrefix },
		enabledModules: [String],
	},
});

export default mongoose.model<IGuild>('Guild', GuildSchema, 'guilds');
