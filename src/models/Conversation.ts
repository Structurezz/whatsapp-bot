import mongoose, { Document, Schema } from 'mongoose';

export interface IConversationData {
  customerName?: string;
}

export interface IConversation extends Document {
  phone: string;
  channel: 'whatsapp' | 'voice';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: any[];
  data: IConversationData;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'voice'],
      default: 'whatsapp',
    },
    history: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    data: {
      customerName: String,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Each phone+channel pair has its own conversation session
ConversationSchema.index({ phone: 1, channel: 1 }, { unique: true });

// Auto-expire stale conversations after 2 hours of inactivity
ConversationSchema.index({ lastMessageAt: 1 }, { expireAfterSeconds: 7200 });

export default mongoose.model<IConversation>('Conversation', ConversationSchema);
