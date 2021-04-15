// Packages
import mongoose, { Schema, Document } from 'mongoose';

export interface IAutoPublish extends Document {
	_id: string
}

const AutoPublishSchema: Schema = new Schema({
	_id: { type: String, required: true },
});

export default mongoose.model<IAutoPublish>('AutoPublish', AutoPublishSchema, 'autoPublish');
