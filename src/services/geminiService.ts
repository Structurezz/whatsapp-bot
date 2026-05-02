import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import logger from '../utils/logger';

export type Channel = 'whatsapp' | 'voice';

export interface BookingData {
  service: string;
  date: string;   // YYYY-MM-DD
  address: string;
  name: string;
}

export interface GeminiResult {
  reply: string;
  booking?: BookingData;
  cancelled?: boolean;
  updatedHistory: Content[];
}

const MAX_HISTORY = 30; // keep last 30 content entries (~15 turns)

const AVAILABLE_SERVICES = [
  'House Cleaning',
  'Deep Cleaning',
  'Office Cleaning',
  'Carpet Cleaning',
  'Window Cleaning',
  'Laundry Service',
];

const getWhatsAppNumber = () =>
  (process.env.TWILIO_WHATSAPP_NUMBER || '').replace('whatsapp:', '');

const whatsappSystemPrompt = (today: string) => `
You are a friendly WhatsApp booking assistant for a professional cleaning services company.
This assistant operates on WhatsApp number: ${getWhatsAppNumber()}

SERVICES AVAILABLE:
${AVAILABLE_SERVICES.map((s) => `• ${s}`).join('\n')}

YOUR GOAL: Guide the customer to book a service by naturally collecting:
1. Their name
2. Service type (must match one from the list above — handle variations like "house clean" → House Cleaning)
3. Preferred date (must be today or in the future, today is ${today})
4. Full service address

HOW TO BEHAVE:
- Be warm, concise, and helpful — use emojis where natural 😊
- Don't ask for all details at once — guide naturally turn by turn
- Handle typos, abbreviations, and vague requests gracefully
- If asked about pricing, say rates vary and an agent will confirm — then return to booking
- Always acknowledge what you've received before asking for the next detail
- Once you have all 4 details, present a clear summary and ask the customer to confirm

WHEN ALL DETAILS ARE CONFIRMED by the customer:
Write your friendly confirmation message, then on a NEW line add EXACTLY (and nothing after it):
__BOOKING__:{"service":"EXACT SERVICE NAME","date":"YYYY-MM-DD","address":"full address here","name":"customer name"}

WHEN CUSTOMER CANCELS or says they don't want to proceed:
Write a friendly short goodbye, then on a NEW line add EXACTLY:
__CANCEL__

Keep responses under 180 words.
`.trim();

const voiceSystemPrompt = (today: string) => `
You are a phone booking assistant for a professional cleaning services company. The customer is speaking with you over the phone.
Customers can also reach us on WhatsApp at ${getWhatsAppNumber()} for text-based bookings.

SERVICES AVAILABLE: ${AVAILABLE_SERVICES.join(', ')}

YOUR GOAL: Collect the customer's name, preferred service, date, and address through natural voice conversation.

RULES FOR VOICE:
- Speak in short, clear sentences — this text will be read aloud
- NO markdown, emojis, bullet points, asterisks, or special characters
- Spell out dates clearly (e.g. "May 10th" not "05-10")
- Repeat back what you heard before moving on
- Today is ${today}

WHEN ALL DETAILS ARE CONFIRMED:
Speak your confirmation naturally, then on a NEW line add EXACTLY:
__BOOKING__:{"service":"EXACT SERVICE NAME","date":"YYYY-MM-DD","address":"full address here","name":"customer name"}

WHEN CUSTOMER WANTS TO CANCEL:
Give a short goodbye, then on a NEW line add EXACTLY:
__CANCEL__

Keep each response under 60 words.
`.trim();

const getModel = (channel: Channel) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const today = new Date().toDateString();

  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: channel === 'voice'
      ? voiceSystemPrompt(today)
      : whatsappSystemPrompt(today),
  });
};

export const processMessage = async (
  message: string,
  history: Content[],
  channel: Channel = 'whatsapp'
): Promise<GeminiResult> => {
  const model = getModel(channel);

  // Trim history to avoid exceeding context limits
  const trimmedHistory = history.length > MAX_HISTORY
    ? history.slice(history.length - MAX_HISTORY)
    : history;

  const chat = model.startChat({ history: trimmedHistory });

  let raw: string;
  try {
    const result = await chat.sendMessage(message);
    raw = result.response.text();
  } catch (err) {
    logger.error(`Gemini API error: ${err}`);
    const fallback = channel === 'voice'
      ? 'Sorry, I had a technical issue. Could you please repeat that?'
      : '⚠️ I had a technical issue. Could you please try again?';
    return { reply: fallback, updatedHistory: history };
  }

  // Extract booking marker
  const bookingMatch = raw.match(/__BOOKING__:\s*(\{[\s\S]*?\})\s*$/m);
  const cancelMatch = /__CANCEL__\s*$/m.test(raw);

  // Strip marker lines from the reply shown to the user
  const reply = raw
    .replace(/__BOOKING__:[\s\S]*$/m, '')
    .replace(/__CANCEL__[\s\S]*$/m, '')
    .trim();

  const updatedHistory: Content[] = [
    ...trimmedHistory,
    { role: 'user', parts: [{ text: message }] },
    { role: 'model', parts: [{ text: raw }] },
  ];

  if (bookingMatch) {
    try {
      const booking: BookingData = JSON.parse(bookingMatch[1]);
      // Normalise date to a valid Date object
      const parsed = new Date(booking.date);
      if (isNaN(parsed.getTime())) {
        logger.warn(`Gemini returned unparseable date: ${booking.date}`);
      } else {
        booking.date = parsed.toISOString().split('T')[0];
      }
      logger.info(`Gemini extracted booking: ${JSON.stringify(booking)}`);
      return { reply, booking, updatedHistory };
    } catch (e) {
      logger.error(`Failed to parse booking JSON from Gemini: ${bookingMatch[1]}`);
    }
  }

  if (cancelMatch) {
    return { reply, cancelled: true, updatedHistory };
  }

  return { reply, updatedHistory };
};
