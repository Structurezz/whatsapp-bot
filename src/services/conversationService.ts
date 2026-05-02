import Conversation from '../models/Conversation';
import { createBooking } from './bookingService';
import { sendWhatsAppMessage } from './twilioService';
import { processMessage, Channel } from './geminiService';
import logger from '../utils/logger';

const RESET_PATTERN = /^(hi|hello|start|restart|hey|book|yo|sup|hiya|good morning|good afternoon|good evening|gm|gn)$/i;

export const handleIncomingMessage = async (
  phone: string,
  message: string,
  profileName?: string,
  channel: Channel = 'whatsapp'
): Promise<string> => {
  const normalizedPhone = phone.replace('whatsapp:', '').trim();
  const input = message.trim();

  let conv = await Conversation.findOne({ phone: normalizedPhone, channel });

  const isReset = RESET_PATTERN.test(input);

  if (!conv) {
    conv = await Conversation.create({
      phone: normalizedPhone,
      channel,
      history: [],
      data: { customerName: profileName },
    });
  } else if (isReset) {
    // Fresh start — wipe history
    conv.history = [];
    conv.data = { customerName: profileName || conv.data.customerName };
    await conv.save();
  } else if (profileName && !conv.data.customerName) {
    conv.data.customerName = profileName;
    await conv.save();
  }

  // Inject name into the first message so Gemini knows who it's talking to
  const enrichedInput =
    conv.history.length === 0 && profileName
      ? `${input} (My name is ${profileName})`
      : input;

  const result = await processMessage(enrichedInput, conv.history, channel);

  // ── Booking confirmed ──────────────────────────────────────────────────────
  if (result.booking) {
    const bookingDate = new Date(result.booking.date);

    if (isNaN(bookingDate.getTime())) {
      const errMsg = channel === 'voice'
        ? "Sorry, I couldn't save the booking because the date was unclear. Let's try again."
        : '⚠️ I had trouble with the date. Could you please tell me again?';
      await _saveHistory(normalizedPhone, channel, result.updatedHistory, conv.data);
      if (channel === 'whatsapp') await sendWhatsAppMessage(normalizedPhone, errMsg);
      return errMsg;
    }

    try {
      const booking = await createBooking({
        customerPhone: normalizedPhone,
        customerName: result.booking.name || profileName || 'Customer',
        service: result.booking.service,
        bookingDate,
        address: result.booking.address,
      });

      logger.info(`Booking created via ${channel}: ${booking._id}`);
      await Conversation.deleteOne({ phone: normalizedPhone, channel });

      if (channel === 'whatsapp') await sendWhatsAppMessage(normalizedPhone, result.reply);
      return result.reply;
    } catch (err) {
      logger.error(`Error creating booking from ${channel}: ${err}`);
      const errMsg = channel === 'voice'
        ? 'Sorry, something went wrong saving your booking. Please call back.'
        : '⚠️ Something went wrong. Please try again or contact support.';
      if (channel === 'whatsapp') await sendWhatsAppMessage(normalizedPhone, errMsg);
      return errMsg;
    }
  }

  // ── Cancelled ──────────────────────────────────────────────────────────────
  if (result.cancelled) {
    await Conversation.deleteOne({ phone: normalizedPhone, channel });
    if (channel === 'whatsapp') await sendWhatsAppMessage(normalizedPhone, result.reply);
    return result.reply;
  }

  // ── Continue conversation ──────────────────────────────────────────────────
  await _saveHistory(normalizedPhone, channel, result.updatedHistory, conv.data);

  if (channel === 'whatsapp') await sendWhatsAppMessage(normalizedPhone, result.reply);
  return result.reply;
};

// Helper: upsert conversation with updated history
const _saveHistory = async (
  phone: string,
  channel: Channel,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: any[],
  data: { customerName?: string }
) => {
  await Conversation.findOneAndUpdate(
    { phone, channel },
    { history, data, lastMessageAt: new Date() },
    { upsert: true, new: true }
  );
};
