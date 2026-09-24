/**
 * Records the voice-over: one clip per shot, from src/narration.json.
 *
 * The voice is Kokoro (Apache-2.0), run locally through kokoro-js, so nothing
 * leaves the machine and nobody needs an API key. "Heart" is the voice its
 * authors grade highest.
 *
 * Writes public/voice/<shot>.wav (git-ignored, like the scores) and
 * src/voice.json, which is committed: the timeline is built from it, so a
 * clean clone has to typecheck and lay out the same video before anybody has
 * run this. It carries each clip's text as well as its length, and story.tsx
 * refuses to build if a line in narration.json no longer matches the clip
 * recorded for it — a stale clip would otherwise say the old words.
 *
 *   npm run voice
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KokoroTTS, TextSplitterStream } from 'kokoro-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'public', 'voice');
const SCRIPT = join(HERE, 'src', 'narration.json');
const TIMINGS = join(HERE, 'src', 'voice.json');

const VOICE = 'af_heart';
/** A shade under Kokoro's natural pace: much of this audience listens in a second language. */
const SPEED = 0.95;

/**
 * Words the phonemiser gets wrong, as the sounds it produces and the sounds
 * they should be. Samudaya is समुदाय, sa-mu-DAA-ya; left alone it comes out
 * as "SAM-you-day-uh".
 */
const PRONOUNCE = [['sˈæmjuːdˌeɪə', 'səmʊdˈɑːjə']];

/** Loudness the clips are levelled to: the music bed sits at about −19 dB and ducks under this. */
const TARGET_DB = -17;
const PEAK = 0.89; // −1 dBFS

const lines = JSON.parse(await readFile(SCRIPT, 'utf8'));
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'fp32',
  device: 'cpu',
});

/** The phonemes kokoro-js would read, sentence by sentence, joined back into one line. */
async function phonemesOf(text) {
  const splitter = new TextSplitterStream();
  splitter.push(text);
  splitter.close();
  const parts = [];
  for await (const { phonemes } of tts.stream(splitter, { voice: VOICE })) parts.push(phonemes);
  return PRONOUNCE.reduce((said, [wrong, right]) => said.replaceAll(wrong, right), parts.join(' '));
}

/** Trim the near-silence Kokoro leaves at either end, so a clip starts when the voice does. */
function trim(samples, rate) {
  const floor = 0.01;
  const pad = Math.round(rate * 0.04);
  let start = 0;
  let end = samples.length;
  while (start < end && Math.abs(samples[start]) < floor) start++;
  while (end > start && Math.abs(samples[end - 1]) < floor) end--;
  return samples.slice(Math.max(0, start - pad), Math.min(samples.length, end + pad));
}

/** Level to TARGET_DB RMS, then hold the peaks under −1 dBFS. */
function level(samples) {
  const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  let gain = 10 ** (TARGET_DB / 20) / rms;
  const peak = samples.reduce((top, value) => Math.max(top, Math.abs(value)), 0);
  gain = Math.min(gain, PEAK / peak);
  return samples.map((value) => value * gain);
}

/** 16-bit PCM mono WAV, which every decoder in the pipeline reads. */
function wav(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, index) => {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), index * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

await mkdir(OUT, { recursive: true });
const timings = {};
for (const [id, text] of Object.entries(lines)) {
  const phonemes = await phonemesOf(text);
  const { input_ids } = tts.tokenizer(phonemes, { truncation: true });
  const audio = await tts.generate_from_ids(input_ids, { voice: VOICE, speed: SPEED });
  const samples = level(trim(audio.audio, audio.sampling_rate));
  await writeFile(join(OUT, `${id}.wav`), wav(samples, audio.sampling_rate));
  const seconds = Math.round((samples.length / audio.sampling_rate) * 100) / 100;
  timings[id] = { text, seconds };
  console.log(`\x1b[36m▸\x1b[0m ${id.padEnd(10)} ${seconds.toFixed(2)}s  ${phonemes}`);
}
await writeFile(
  TIMINGS,
  `${JSON.stringify({ voice: VOICE, speed: SPEED, clips: timings }, null, 2)}\n`,
);
console.log(`\x1b[36m▸\x1b[0m src/voice.json — ${Object.keys(timings).length} clips`);
