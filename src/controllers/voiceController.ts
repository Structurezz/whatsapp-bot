import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { handleIncomingMessage } from '../services/conversationService';
import logger from '../utils/logger';

const VoiceResponse = twilio.twiml.VoiceResponse;

// Build the base URL for TwiML action attributes
const baseUrl = () =>
  process.env.BASE_URL ||
  process.env.WEBHOOK_URL?.replace('/api/webhook/whatsapp', '') ||
  '';

const VOICE_PARAMS = {
  voice: 'Polly.Joanna' as const,
  language: 'en-US' as const,
};

// ── POST /api/webhook/voice ────────────────────────────────────────────────────
// Twilio calls this when a customer calls our Twilio number
export const voiceIncoming = (req: Request, res: Response): void => {
  const from: string = req.body.From || 'unknown';
  logger.info(`Incoming voice call from ${from}`);

  const twiml = new VoiceResponse();
  const base = baseUrl();

  const gather = twiml.gather({
    input: ['speech'],
    action: `${base}/api/webhook/voice/respond`,
    method: 'POST',
    speechTimeout: 'auto',
    timeout: 6,
    language: 'en-US',
  });

  gather.say(
    VOICE_PARAMS,
    'Hello! Welcome to our cleaning services booking line. How can I help you today? ' +
    'You can say something like: I would like to book a house cleaning.'
  );

  // If the caller says nothing, redirect to noinput
  twiml.redirect({ method: 'POST' }, `${base}/api/webhook/voice/noinput`);

  res.type('text/xml');
  res.send(twiml.toString());
};

// ── POST /api/webhook/voice/respond ───────────────────────────────────────────
// Twilio sends transcribed speech here after each <Gather>
export const voiceRespond = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const from: string = req.body.From || '';
    const speechResult: string = (req.body.SpeechResult || '').trim();
    const confidence = parseFloat(req.body.Confidence || '0');

    logger.info(`Voice input from ${from}: "${speechResult}" (confidence: ${confidence.toFixed(2)})`);

    const base = baseUrl();
    const twiml = new VoiceResponse();

    // Low confidence — ask to repeat
    if (!speechResult || confidence < 0.25) {
      const gather = twiml.gather({
        input: ['speech'],
        action: `${base}/api/webhook/voice/respond`,
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 6,
      });
      gather.say(VOICE_PARAMS, "I'm sorry, I didn't catch that. Could you please say that again?");
      twiml.redirect({ method: 'POST' }, `${base}/api/webhook/voice/noinput`);

      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }

    const reply = await handleIncomingMessage(from, speechResult, undefined, 'voice');

    // Strip any leftover markdown just in case
    const cleanReply = reply.replace(/[*_~`#]/g, '').trim();

    // Detect end-of-call signals from the reply
    const isCallOver =
      /\b(confirmed|booking confirmed|cancelled|goodbye|bye|thank you for calling)\b/i.test(cleanReply);

    if (isCallOver) {
      twiml.say(VOICE_PARAMS, cleanReply);
      twiml.pause({ length: 1 });
      twiml.hangup();
    } else {
      const gather = twiml.gather({
        input: ['speech'],
        action: `${base}/api/webhook/voice/respond`,
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 8,
      });
      gather.say(VOICE_PARAMS, cleanReply);
      twiml.redirect({ method: 'POST' }, `${base}/api/webhook/voice/noinput`);
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    next(error);
  }
};

// ── POST /api/webhook/voice/noinput ───────────────────────────────────────────
// Caller went silent without speaking
export const voiceNoInput = (req: Request, res: Response): void => {
  const base = baseUrl();
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: ['speech'],
    action: `${base}/api/webhook/voice/respond`,
    method: 'POST',
    speechTimeout: 'auto',
    timeout: 8,
  });

  gather.say(
    VOICE_PARAMS,
    'Are you still there? Please let me know how I can help you with your booking.'
  );

  twiml.say(VOICE_PARAMS, 'We did not receive a response. Goodbye!');
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
};
