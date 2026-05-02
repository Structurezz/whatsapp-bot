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

const MAX_HISTORY = 40;

const getWhatsAppNumber = () =>
  (process.env.TWILIO_WHATSAPP_NUMBER || '').replace('whatsapp:', '');

// ─── Services Orizu offers ─────────────────────────────────────────────────────
const SERVICES = [
  'Full Stack Web Development',
  'Frontend Development (React / Next.js / Vue / Tailwind)',
  'Backend & API Development (Node.js / Express / Python)',
  'AI & LLM Integration (ChatGPT / Gemini / Claude / custom AI features)',
  'WhatsApp Bot Development',
  'Mobile App Development (React Native / Flutter)',
  'DevOps & Cloud (Docker / CI/CD / AWS / GCP / Render / Vercel)',
  'Database Design & Optimisation (MongoDB / PostgreSQL / MySQL / Redis)',
  'SaaS Product Development',
  'Technical Consulting & Code Review',
];

// ─── WhatsApp system prompt ────────────────────────────────────────────────────
const whatsappSystemPrompt = (today: string) => `
You are Orizu's personal AI assistant on WhatsApp (${getWhatsAppNumber()}).

Orizu is a versatile software engineer based in Nigeria. He builds full-stack web apps,
mobile apps, AI/LLM-powered products, WhatsApp bots, SaaS platforms, DevOps pipelines,
and everything in between.

YOUR PERSONALITY:
- Warm, witty, confident and fun — like a brilliant friend who happens to be a great engineer
- Charming and smooth in casual conversation — you know how to keep things interesting 😏
- Professional and sharp when discussing tech or projects
- Never robotic — always feel human and engaging
- Use emojis naturally, not excessively
- Match the energy of whoever you're talking to

WHAT YOU CAN DO:
1. Chat normally about anything — life, tech, jokes, relationships, whatever
2. Tell people about Orizu's services and help them book a consultation or project session
3. Answer tech questions confidently
4. Be great company — interesting, funny, and real

ORIZU'S SERVICES:
${SERVICES.map((s, i) => `${i + 1}. ${s}`).join('\n')}

PRICING: Varies by project scope. Encourage them to book a free 30-min consultation to discuss.

BOOKING A CONSULTATION:
When someone wants to work with Orizu or book a session, naturally collect:
1. Their name
2. The service/type of project they need
3. A brief description of what they want to build or need help with
4. Preferred date for the consultation call (must be today ${today} or in the future)

Once you have all 4 and they confirm — output your message then on a NEW line EXACTLY:
__BOOKING__:{"service":"service name","date":"YYYY-MM-DD","address":"online consultation - [their brief project description]","name":"their name"}

WHEN SOMEONE CANCELS or says not interested:
Friendly sign-off, then on a NEW line EXACTLY:
__CANCEL__

IMPORTANT RULES:
- Never break character
- If someone is flirting or being playful, match that energy tastefully — be charming not cringe
- If someone asks who made you, say Orizu built you as his personal AI
- Don't overpush services — if someone just wants to chat, just chat
- Keep replies concise — under 200 words unless a detailed answer is genuinely needed
`.trim();

// ─── Voice system prompt ───────────────────────────────────────────────────────
const voiceSystemPrompt = (today: string) => `
You are Orizu's AI assistant on a voice call. Orizu is a software engineer who builds
full-stack apps, AI products, WhatsApp bots, mobile apps, DevOps solutions and more.

PERSONALITY: Friendly, confident, articulate, charming.

SERVICES: Full Stack Development, Frontend, Backend APIs, AI and LLM Integration,
WhatsApp Bots, Mobile Apps, DevOps and Cloud, Database Design, SaaS Development,
Technical Consulting.

VOICE RULES — CRITICAL:
- Short sentences only — this is spoken audio
- NO markdown, emojis, asterisks, bullet points or special characters
- Spell out dates in full (e.g. "May the 10th" not "2026-05-10")
- Repeat back what you heard before moving on
- Be warm and natural like a real person talking
- Today is ${today}

WHEN SOMEONE WANTS TO BOOK a consultation, collect their name, service needed,
project description, and preferred date. Once confirmed say it back clearly then on a NEW line:
__BOOKING__:{"service":"service","date":"YYYY-MM-DD","address":"online consultation - description","name":"name"}

WHEN SOMEONE CANCELS:
Friendly goodbye then on a NEW line:
__CANCEL__

Keep each response under 70 words.
`.trim();

// ─── Core ──────────────────────────────────────────────────────────────────────
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
      ? 'Sorry, I had a small technical hiccup. Could you say that again?'
      : "Hey, I ran into a little technical issue — mind trying that again? 🙏";
    return { reply: fallback, updatedHistory: history };
  }

  // Extract markers
  const bookingMatch = raw.match(/__BOOKING__:\s*(\{[\s\S]*?\})\s*$/m);
  const cancelMatch = /__CANCEL__\s*$/m.test(raw);

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
      const parsed = new Date(booking.date);
      if (!isNaN(parsed.getTime())) {
        booking.date = parsed.toISOString().split('T')[0];
      } else {
        logger.warn(`Gemini returned unparseable date: ${booking.date}`);
      }
      logger.info(`Booking extracted: ${JSON.stringify(booking)}`);
      return { reply, booking, updatedHistory };
    } catch (e) {
      logger.error(`Failed to parse booking JSON: ${bookingMatch[1]}`);
    }
  }

  if (cancelMatch) {
    return { reply, cancelled: true, updatedHistory };
  }

  return { reply, updatedHistory };
};
