// Packages
import mongoose, { Schema, Document } from 'mongoose';

export interface IModStrike extends Document {
	id: string,
	userId: string,
	guild: string,
	strikeDate: Date,
	tos: boolean,
}

const ModStrikeSchema: Schema = new Schema({
	id: { type: String, required: true },
	userId: { type: String, required: true },
	guild: { type: String, required: true },
	strikeDate: { type: Date, default: new Date() },
	tos: { type: Boolean, default: false },
});

export default mongoose.model<IModStrike>('Strike', ModStrikeSchema, 'strikes');
