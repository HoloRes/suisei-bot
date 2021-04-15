// Packages
import mongoose, { Schema, Document } from 'mongoose';

export interface IModLogItem extends Document {
	id: string,
	guild: string,
	userId: string,
	type: 'warn' | 'mute' | 'kick' | 'ban',
	duration?: string,
	moderation: string,
	reason: string,
	date: Date,
}

const ModLogSchema: Schema = new Schema({
	id: { type: String, required: true },
	guild: { type: String, required: true },
	userId: { type: String, required: true },
	type: { type: String, required: true, enum: ['warn', 'mute', 'kick', 'ban'] },
	duration: { type: String },
	moderator: { type: String, required: true },
	reason: { type: String, required: true },
	date: { type: Date },
});

export default mongoose.model<IModLogItem>('ModLogItem', ModLogSchema, 'modLog');
