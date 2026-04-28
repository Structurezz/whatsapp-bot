import Conversation, {
  IConversation,
  ConversationState,
} from '../models/Conversation';
import { createBooking } from './bookingService';
import { sendWhatsAppMessage } from './twilioService';
import logger from '../utils/logger';

// Available services — can be loaded from DB in a real multi-tenant setup
const AVAILABLE_SERVICES = [
  'House Cleaning',
  'Deep Cleaning',
  'Office Cleaning',
  'Carpet Cleaning',
  'Window Cleaning',
  'Laundry Service',
];

const buildServiceMenu = (): string => {
  const lines = AVAILABLE_SERVICES.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return `Please choose a service:\n${lines}\n\nReply with the number.`;
};

const parseServiceChoice = (input: string): string | null => {
  const num = parseInt(input.trim(), 10);
  if (num >= 1 && num <= AVAILABLE_SERVICES.length) {
    return AVAILABLE_SERVICES[num - 1];
  }
  return null;
};

const parseDate = (input: string): Date | null => {
  // Accept formats: DD/MM/YYYY, YYYY-MM-DD, "tomorrow", "today"
  const trimmed = input.trim().toLowerCase();

  if (trimmed === 'today') {
    return new Date();
  }
  if (trimmed === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }

  // Try DD/MM/YYYY
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = trimmed.match(ddmmyyyy);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Try YYYY-MM-DD or any standard format
  const d = new Date(input.trim());
  if (!isNaN(d.getTime())) return d;

  return null;
};

export const handleIncomingMessage = async (
  phone: string,
  message: string,
  profileName?: string
): Promise<void> => {
  const normalizedPhone = phone.replace('whatsapp:', '');
  const input = message.trim();

  // Fetch or create conversation session
  let conv = await Conversation.findOne({ phone: normalizedPhone });

  // Allow user to restart at any point
  if (/^(hi|hello|start|restart|hey|book)$/i.test(input)) {
    if (conv) {
      conv.state = 'START';
      conv.data = {};
      conv.lastMessageAt = new Date();
      await conv.save();
    } else {
      conv = new Conversation({ phone: normalizedPhone, state: 'START', data: {} });
      await conv.save();
    }
  }

  if (!conv) {
    conv = new Conversation({ phone: normalizedPhone, state: 'START', data: {} });
    await conv.save();
  }

  conv.lastMessageAt = new Date();
  if (profileName && !conv.data.customerName) {
    conv.data.customerName = profileName;
  }

  let reply = '';

  switch (conv.state) {
    case 'START': {
      conv.state = 'SELECT_SERVICE';
      reply = `👋 Welcome${profileName ? ` ${profileName}` : ''}! I'm your booking assistant.\n\n${buildServiceMenu()}`;
      break;
    }

    case 'SELECT_SERVICE': {
      const service = parseServiceChoice(input);
      if (!service) {
        reply = `❌ Invalid choice. ${buildServiceMenu()}`;
        break;
      }
      conv.data.service = service;
      conv.state = 'SELECT_DATE';
      reply = `✅ You selected: *${service}*\n\nWhat date would you like the service?\n📅 Format: DD/MM/YYYY or "today" / "tomorrow"`;
      break;
    }

    case 'SELECT_DATE': {
      const date = parseDate(input);
      if (!date) {
        reply = '❌ Invalid date. Please use DD/MM/YYYY, "today", or "tomorrow".';
        break;
      }
      if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
        reply = '❌ You cannot book for a past date. Please choose a future date.';
        break;
      }
      conv.data.bookingDate = date.toISOString();
      conv.state = 'ENTER_ADDRESS';
      reply = `✅ Date set: *${date.toDateString()}*\n\n📍 Please enter your full service address:`;
      break;
    }

    case 'ENTER_ADDRESS': {
      if (input.length < 5) {
        reply = '❌ Please provide a valid address (minimum 5 characters).';
        break;
      }
      conv.data.address = input;
      conv.state = 'CONFIRM';

      const d = new Date(conv.data.bookingDate!);
      reply =
        `📋 *Booking Summary*\n\n` +
        `🔧 Service: ${conv.data.service}\n` +
        `📅 Date: ${d.toDateString()}\n` +
        `📍 Address: ${conv.data.address}\n\n` +
        `Reply *YES* to confirm or *NO* to cancel.`;
      break;
    }

    case 'CONFIRM': {
      const yes = /^(yes|y|confirm|ok|okay)$/i.test(input);
      const no = /^(no|n|cancel|stop)$/i.test(input);

      if (!yes && !no) {
        reply = 'Please reply *YES* to confirm or *NO* to cancel.';
        break;
      }

      if (no) {
        conv.state = 'DONE';
        await conv.deleteOne();
        reply = '❌ Booking cancelled. Type *hi* to start a new booking anytime!';
        break;
      }

      // Create booking in DB
      try {
        const booking = await createBooking({
          customerPhone: normalizedPhone,
          customerName: conv.data.customerName || 'WhatsApp Customer',
          service: conv.data.service!,
          bookingDate: new Date(conv.data.bookingDate!),
          address: conv.data.address!,
        });

        conv.state = 'DONE';
        await conv.deleteOne();

        reply =
          `✅ *Booking Confirmed!*\n\n` +
          `🆔 Ref: #${String(booking._id).slice(-6).toUpperCase()}\n` +
          `🔧 Service: ${booking.service}\n` +
          `📅 Date: ${booking.bookingDate.toDateString()}\n` +
          `📍 Address: ${booking.address}\n\n` +
          `We'll be in touch soon. Type *hi* to make another booking!`;

        logger.info(`Booking created via WhatsApp: ${booking._id}`);
      } catch (err) {
        logger.error(`Error creating booking from WhatsApp: ${err}`);
        reply = '⚠️ Something went wrong. Please try again or contact support.';
      }
      break;
    }

    default: {
      conv.state = 'START';
      reply = 'Type *hi* to start a new booking.';
    }
  }

  await Conversation.findOneAndUpdate(
    { phone: normalizedPhone },
    {
      state: conv.state,
      data: conv.data,
      lastMessageAt: conv.lastMessageAt,
    },
    { upsert: true, new: true }
  );

  await sendWhatsAppMessage(normalizedPhone, reply);
};
