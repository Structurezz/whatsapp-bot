import mongoose, { Document, Schema } from 'mongoose';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface IBooking extends Document {
  customerPhone: string;
  customerName: string;
  service: string;
  bookingDate: Date;
  address: string;
  status: BookingStatus;
  notes?: string;
  confirmedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    customerPhone: {
      type: String,
      required: [true, 'Customer phone is required'],
      trim: true,
    },
    customerName: {
      type: String,
      default: 'Unknown',
      trim: true,
    },
    service: {
      type: String,
      required: [true, 'Service is required'],
      trim: true,
    },
    bookingDate: {
      type: Date,
      required: [true, 'Booking date is required'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    notes: {
      type: String,
      trim: true,
    },
    confirmedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

// Indexes for common queries
BookingSchema.index({ customerPhone: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ bookingDate: 1 });
BookingSchema.index({ createdAt: -1 });

export default mongoose.model<IBooking>('Booking', BookingSchema);
