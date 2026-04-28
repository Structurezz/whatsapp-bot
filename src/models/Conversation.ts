import mongoose, { Document, Schema } from 'mongoose';

export type ConversationState =
  | 'START'
  | 'SELECT_SERVICE'
  | 'SELECT_DATE'
  | 'ENTER_ADDRESS'
  | 'CONFIRM'
  | 'DONE';

export interface IConversationData {
  service?: string;
  bookingDate?: string;
  address?: string;
  customerName?: string;
}

export interface IConversation extends Document {
  phone: string;
  state: ConversationState;
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
      unique: true,
      trim: true,
    },
    state: {
      type: String,
      enum: ['START', 'SELECT_SERVICE', 'SELECT_DATE', 'ENTER_ADDRESS', 'CONFIRM', 'DONE'],
      default: 'START',
    },
    data: {
      service: String,
      bookingDate: String,
      address: String,
      customerName: String,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Auto-expire stale conversations after 2 hours of inactivity
ConversationSchema.index(
  { lastMessageAt: 1 },
  { expireAfterSeconds: 7200 }
);

export default mongoose.model<IConversation>('Conversation', ConversationSchema);
