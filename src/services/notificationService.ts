import { IBooking, BookingStatus } from '../models/Booking';
import { sendWhatsAppMessage } from './twilioService';
import logger from '../utils/logger';

const formatDate = (date: Date) =>
  new Date(date).toDateString();

const MESSAGES: Record<BookingStatus, (b: IBooking) => string> = {
  confirmed: (b) =>
    `✅ *Booking Confirmed!*\n\n` +
    `Hi ${b.customerName}, your booking has been confirmed by our team.\n\n` +
    `🔧 Service: ${b.service}\n` +
    `📅 Date: ${formatDate(b.bookingDate)}\n` +
    `📍 Address: ${b.address}\n\n` +
    `We'll see you soon! Reply *hi* to make another booking.`,

  completed: (b) =>
    `🎉 *Service Completed!*\n\n` +
    `Hi ${b.customerName}, your ${b.service} has been marked as completed.\n\n` +
    `Thank you for choosing us! We hope you're satisfied with our service.\n\n` +
    `Reply *hi* to book again anytime.`,

  cancelled: (b) =>
    `❌ *Booking Cancelled*\n\n` +
    `Hi ${b.customerName}, your booking has been cancelled.\n\n` +
    `🔧 Service: ${b.service}\n` +
    `📅 Date: ${formatDate(b.bookingDate)}\n\n` +
    `If this was a mistake or you'd like to rebook, reply *hi* and we'll get you sorted.`,

  pending: (b) =>
    `🕐 *Booking Received*\n\n` +
    `Hi ${b.customerName}, we've received your booking request.\n\n` +
    `🔧 Service: ${b.service}\n` +
    `📅 Date: ${formatDate(b.bookingDate)}\n` +
    `📍 Address: ${b.address}\n\n` +
    `Our team will confirm shortly.`,
};

export const notifyCustomer = async (
  booking: IBooking,
  newStatus: BookingStatus,
  oldStatus?: BookingStatus
): Promise<void> => {
  // Only notify on actual status changes
  if (newStatus === oldStatus) return;

  const phone = booking.customerPhone;
  if (!phone) return;

  const messageFn = MESSAGES[newStatus];
  if (!messageFn) return;

  try {
    await sendWhatsAppMessage(phone, messageFn(booking));
    logger.info(`WhatsApp notification sent to ${phone} — status: ${newStatus}`);
  } catch (err) {
    // Don't fail the booking update if notification fails
    logger.error(`Failed to notify ${phone} of status ${newStatus}: ${err}`);
  }
};
