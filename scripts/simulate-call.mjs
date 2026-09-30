#!/usr/bin/env node
/**
 * simulate-call.mjs — Zero-dependency local Twilio SOS call & media stream simulator.
 *
 * Simulates incoming Twilio voice webhooks and optional bi-directional Media Streams
 * for testing the AEGIS-911 dispatch console without active Twilio or AssemblyAI accounts.
 *
 * Usage:
 *   node scripts/simulate-call.mjs [options]
 *
 * Options:
 *   --from <number>       Caller phone number (E.164 format, default: +15550199110)
 *   --to <number>         Dialed SOS line number (E.164 format, default: +15559110000)
 *   --call-sid <sid>      Twilio CallSid (default: CA + 32 random hex chars)
 *   --server <url>        Base server URL (default: http://localhost:8080)
 *   --stream              Connect to Media Stream WebSocket extracted from TwiML <Stream url>
 *   --duration <seconds>  Stream duration in seconds (default: 30)
 *   --interval <ms>       Frame & transcript injection interval in ms (default: 500)
 *   --help, -h            Show this help documentation
 *
 * Examples:
 *   # Quick webhook test
 *   node scripts/simulate-call.mjs
 *
 *   # Custom caller and server port
 *   node scripts/simulate-call.mjs --from +15551234567 --server http://localhost:4000
 *
 *   # Full simulation with audio stream and live transcript injection for 20 seconds
 *   node scripts/simulate-call.mjs --stream --duration 20
 */

import crypto from 'node:crypto';

// Parse command line arguments
function parseArgs(args) {
  const options = {
    from: '+15550199110',
    to: '+15559110000',
    callSid: null,
    server: 'http://localhost:8080',
    stream: false,
    duration: 30,
    interval: 500,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--stream') {
      options.stream = true;
    } else if (arg === '--from' && i + 1 < args.length) {
      options.from = args[++i];
    } else if (arg === '--to' && i + 1 < args.length) {
      options.to = args[++i];
    } else if (arg === '--call-sid' && i + 1 < args.length) {
      options.callSid = args[++i];
    } else if (arg === '--server' && i + 1 < args.length) {
      options.server = args[++i];
    } else if (arg === '--duration' && i + 1 < args.length) {
      options.duration = parseFloat(args[++i]) || 30;
    } else if (arg === '--interval' && i + 1 < args.length) {
      options.interval = parseInt(args[++i], 10) || 500;
    }
  }

  return options;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help) {
  console.log(`
AEGIS-911 Call Simulation CLI Tool
Simulate Twilio voice webhooks and Media Streams WebSocket connections.

Usage:
  node scripts/simulate-call.mjs [options]

Options:
  --from <number>       Caller phone number (default: +15550199110)
  --to <number>         Dialed SOS line number (default: +15559110000)
  --call-sid <sid>      Twilio CallSid (default: random CA...)
  --server <url>        Base server URL (default: http://localhost:8080)
  --stream              Connect to WebSocket Media Stream extracted from TwiML
  --duration <seconds>  Stream duration in seconds (default: 30)
  --interval <ms>       Frame / transcript interval in ms (default: 500)
  --help, -h            Show this help message
`);
  process.exit(0);
}

// Generate CallSid if not provided
const callSid = opts.callSid || `CA${crypto.randomBytes(16).toString('hex')}`;
const streamSid = `MZ${crypto.randomBytes(16).toString('hex')}`;

// Normalize base server URL
const serverBase = opts.server.replace(/\/+$/, '');
const webhookUrl = `${serverBase}/webhooks/twilio/voice`;

console.log('='.repeat(70));
console.log('  AEGIS-911 Telephony Simulator');
console.log('='.repeat(70));
console.log(`Target Webhook : ${webhookUrl}`);
console.log(`Call SID       : ${callSid}`);
console.log(`From (Caller)  : ${opts.from}`);
console.log(`To (SOS Line)  : ${opts.to}`);
console.log(`Media Stream   : ${opts.stream ? `YES (${opts.duration}s duration)` : 'NO (webhook only)'}`);
console.log('='.repeat(70));

// Form-encode fake Twilio voice webhook parameters
const params = new URLSearchParams({
  CallSid: callSid,
  AccountSid: 'AC' + '0'.repeat(32),
  From: opts.from,
  To: opts.to,
  CallStatus: 'ringing',
  Direction: 'inbound',
  ApiVersion: '2010-04-01',
});

let twimlResponseText = '';

try {
  console.log(`\n[1/2] Dispatching POST ${webhookUrl}...`);
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'TwilioProxy/1.1',
    },
    body: params.toString(),
  });

  console.log(`Response Status: ${res.status} ${res.statusText}`);
  twimlResponseText = await res.text();
  console.log('\n--- Received TwiML Response ---');
  console.log(twimlResponseText.trim());
  console.log('-------------------------------\n');

  if (!res.ok) {
    console.error(`[!] Webhook call returned non-200 status: ${res.status}`);
  }
} catch (err) {
  console.error(`[!] Failed to reach webhook endpoint: ${err.message}`);
  if (!opts.stream) {
    process.exit(1);
  }
}

if (!opts.stream) {
  console.log('[✓] Webhook simulation complete. Run with --stream to connect media stream WebSocket.');
  process.exit(0);
}

// Extract Stream URL from TwiML
// Matches <Stream url="..." /> or <Stream ... url="..." ...>
const streamUrlMatch = twimlResponseText.match(/<Stream[^>]+url=["']([^"']+)["']/i);
let targetWsUrl = streamUrlMatch ? streamUrlMatch[1] : null;

if (!targetWsUrl) {
  // If parsing failed or server responded without Stream, fallback to default internal/server ws endpoint
  const wsProto = serverBase.startsWith('https') ? 'wss' : 'ws';
  const hostPort = serverBase.replace(/^https?:\/\//, '');
  targetWsUrl = `${wsProto}://${hostPort}/twilio`;
  console.warn(`[!] Could not parse <Stream url="..."> from TwiML response.`);
  console.log(`    Falling back to computed default WebSocket URL: ${targetWsUrl}`);
} else {
  console.log(`[✓] Extracted Stream URL from TwiML: ${targetWsUrl}`);
}

console.log(`\n[2/2] Opening WebSocket to Media Stream: ${targetWsUrl}`);

// In Twilio media streams, audio is 8000Hz mu-law (PCMU).
// In mu-law, 0xFF represents digital silence / minimum amplitude.
// 500ms of 8000Hz 8-bit audio = 4000 samples/bytes.
const silenceBuffer = Buffer.alloc(4000, 0xff);
const silenceBase64 = silenceBuffer.toString('base64');

// Realistic emergency phrases to cycle through transcript injection
const samplePhrases = [
  "Hello? Can you hear me? I need emergency help!",
  "There's heavy smoke coming from the electrical panel in the garage.",
  "My father collapsed on the floor and is having trouble breathing.",
  "We are at 742 Evergreen Terrace near the north intersection.",
  "Please hurry, he is conscious but his pulse is very weak.",
  "I smelled burning plastic about ten minutes ago before the alarms started.",
  "I'm keeping the doors closed like you suggested.",
  "Emergency medical services are on their way, right?",
];

// Check Node version WebSocket support (Node 22 has global WebSocket)
if (typeof WebSocket === 'undefined') {
  console.error('[!] Global WebSocket is not available in this Node runtime.');
  console.error('    Please ensure you are using Node >= 22.');
  process.exit(1);
}

const ws = new WebSocket(targetWsUrl);

let sequenceNumber = 1;
let intervalTimer = null;
let phraseIndex = 0;
const startTime = Date.now();

ws.addEventListener('open', () => {
  console.log(`[WS] Connected successfully to ${targetWsUrl}`);

  // 1. Send Twilio 'connected' event
  const connectedMsg = {
    event: 'connected',
    protocol: 'Call',
    version: '1.0.0',
  };
  ws.send(JSON.stringify(connectedMsg));
  console.log(`[WS →] Sent event: connected`);

  // 2. Send Twilio 'start' event
  const startMsg = {
    event: 'start',
    sequenceNumber: String(sequenceNumber++),
    start: {
      streamSid,
      accountSid: 'AC' + '0'.repeat(32),
      callSid,
      tracks: ['inbound'],
      customParameters: {
        From: opts.from,
        To: opts.to,
      },
      mediaFormat: {
        encoding: 'audio/x-mulaw',
        sampleRate: 8000,
        channels: 1,
      },
    },
    streamSid,
  };
  ws.send(JSON.stringify(startMsg));
  console.log(`[WS →] Sent event: start (streamSid=${streamSid}, callSid=${callSid})`);

  // 3. Periodic timer to send media frames + transcript injection
  intervalTimer = setInterval(() => {
    const elapsedSec = (Date.now() - startTime) / 1000;
    if (elapsedSec >= opts.duration) {
      console.log(`\n[WS] Reached specified duration of ${opts.duration}s. Ending stream...`);
      clearInterval(intervalTimer);

      // Send Twilio 'stop' event
      const stopMsg = {
        event: 'stop',
        sequenceNumber: String(sequenceNumber++),
        stop: {
          callSid,
          accountSid: 'AC' + '0'.repeat(32),
        },
        streamSid,
      };
      ws.send(JSON.stringify(stopMsg));
      console.log(`[WS →] Sent event: stop`);
      ws.close();
      return;
    }

    // Send base64 mu-law silence media frame
    const mediaMsg = {
      event: 'media',
      sequenceNumber: String(sequenceNumber++),
      media: {
        track: 'inbound',
        chunk: String(sequenceNumber),
        timestamp: String(Math.floor(elapsedSec * 1000)),
        payload: silenceBase64,
      },
      streamSid,
    };
    ws.send(JSON.stringify(mediaMsg));

    // Send JSON transcript injection control message
    const phrase = samplePhrases[phraseIndex % samplePhrases.length];
    phraseIndex++;

    const transcriptInjection = {
      event: 'transcript_injection',
      type: 'transcript',
      streamSid,
      callSid,
      channel: 'CALLER',
      speaker: 'CALLER',
      text: phrase,
      confidence: 0.96,
      timestamp: Date.now(),
      elapsedSeconds: Math.round(elapsedSec * 10) / 10,
    };
    ws.send(JSON.stringify(transcriptInjection));

    console.log(
      `[WS →] Frame #${sequenceNumber} sent (+ silence media frame & injected utterance: "${phrase.slice(0, 40)}...")`
    );
  }, opts.interval);
});

ws.addEventListener('message', (event) => {
  try {
    const parsed = JSON.parse(event.data);
    console.log(`[WS ←] Received event: ${parsed.event || parsed.type || 'message'}`, parsed);
  } catch {
    console.log(`[WS ←] Received raw message: ${event.data.toString().slice(0, 120)}`);
  }
});

ws.addEventListener('error', (err) => {
  console.error(`[WS !] Error:`, err.message || err);
});

ws.addEventListener('close', (event) => {
  if (intervalTimer) clearInterval(intervalTimer);
  console.log(`[WS] Connection closed (code: ${event.code}, reason: ${event.reason || 'normal'})`);
  console.log('[✓] Simulation ended.');
  process.exit(0);
});

// Handle graceful interruption (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n[!] Interrupted by user (SIGINT). Terminating stream...');
  if (intervalTimer) clearInterval(intervalTimer);
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(
        JSON.stringify({
          event: 'stop',
          streamSid,
          stop: { callSid },
        })
      );
      ws.close();
    } catch {
      // ignore
    }
  }
  process.exit(0);
});
