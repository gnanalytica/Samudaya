/**
 * The score, written rather than licensed.
 *
 * A demo video needs a bed under it, and every other way of getting one ends
 * badly: a "royalty free" download whose licence nobody on the committee can
 * produce two years later, or a library subscription for ninety seconds of
 * audio. This synthesises it from scratch, so the only licence involved is
 * this repository's.
 *
 * What it is trying to sound like: a room where the accounts are being read
 * out and nobody is worried. Warm, slow, no percussion — a drum loop would
 * make a public ledger feel like a sneaker advertisement. It stays out of the
 * way of the captions, which is the actual job.
 *
 *   node score/compose.mjs [seconds] [out.wav]
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RATE = 48_000;
const CHANNELS = 2;

const seconds = Number(process.argv[2] ?? 100);
const outPath = process.argv[3] ?? join(HERE, '..', 'public', 'score.wav');

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
/** Equal temperament from A4, which is the only tuning anybody expects. */
const hz = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);

/**
 * D major pentatonic. Pentatonic because every pair of notes in it consents to
 * being played together — an arpeggio can wander without ever landing on the
 * clash that would pull an ear off the screen.
 */
const D2 = -31;
const SCALE = [0, 2, 4, 7, 9]; // D E F# A B
const degree = (step) => {
  const octave = Math.floor(step / SCALE.length);
  return D2 + 12 * octave + SCALE[((step % SCALE.length) + SCALE.length) % SCALE.length];
};

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------
/**
 * A plucked note: a few harmonics, each decaying faster than the one below it,
 * which is roughly what a string does and entirely unlike what a raw sine
 * does. The slight detune keeps it from sounding like a test tone.
 */
function pluck(buffer, atSample, freq, gain, decay) {
  const partials = [
    { ratio: 1, level: 1, decay: 1 },
    { ratio: 2.0, level: 0.34, decay: 1.7 },
    { ratio: 3.01, level: 0.12, decay: 2.6 },
    { ratio: 4.02, level: 0.05, decay: 3.4 },
  ];
  const length = Math.floor(decay * 4 * RATE);

  for (let i = 0; i < length; i += 1) {
    const at = atSample + i;
    if (at >= buffer.length / CHANNELS) break;
    const t = i / RATE;
    // A short attack, so the note arrives rather than clicks.
    const attack = Math.min(1, t / 0.006);
    let sample = 0;
    for (const p of partials) {
      sample +=
        p.level * Math.sin(2 * Math.PI * freq * p.ratio * t) * Math.exp(-t / (decay / p.decay));
    }
    const value = sample * gain * attack;
    // Gently wider with pitch: high notes drift right, low ones sit centre.
    const pan = Math.max(-0.4, Math.min(0.4, (freq - 200) / 1400));
    buffer[at * CHANNELS] += value * (1 - Math.max(0, pan));
    buffer[at * CHANNELS + 1] += value * (1 + Math.min(0, pan));
  }
}

/**
 * A pad: two slightly detuned sines per note, which beat against each other
 * slowly enough to read as warmth rather than as wobble.
 */
function pad(buffer, atSample, freq, gain, lengthSeconds) {
  const length = Math.floor(lengthSeconds * RATE);
  const rise = 1.2 * RATE;
  const fall = 2.2 * RATE;

  for (let i = 0; i < length; i += 1) {
    const at = atSample + i;
    if (at >= buffer.length / CHANNELS) break;
    const t = i / RATE;
    const envelope = Math.min(1, i / rise) * Math.min(1, (length - i) / fall);
    const a = Math.sin(2 * Math.PI * freq * t);
    const b = Math.sin(2 * Math.PI * freq * 1.003 * t);
    const c = 0.28 * Math.sin(2 * Math.PI * freq * 2 * t);
    const value = ((a + b) / 2 + c) * gain * envelope;
    buffer[at * CHANNELS] += value * 0.98;
    buffer[at * CHANNELS + 1] += value * 1.02;
  }
}

// ---------------------------------------------------------------------------
// Arrangement
// ---------------------------------------------------------------------------
const BPM = 68;
const beat = 60 / BPM;

function arrange(totalSeconds) {
  const frames = Math.ceil(totalSeconds * RATE);
  const buffer = new Float64Array(frames * CHANNELS);

  // Four chords, each two bars long, cycling. I – V – vi – IV in feel, voiced
  // low and wide so the captions have the whole midrange to themselves.
  const chords = [
    [0, 4, 7],
    [7, 11, 14],
    [9, 12, 16],
    [5, 9, 12],
  ];
  const chordLength = beat * 8;

  for (let index = 0; index * chordLength < totalSeconds; index += 1) {
    const chord = chords[index % chords.length];
    const at = Math.floor(index * chordLength * RATE);
    for (const [voice, semitone] of chord.entries()) {
      pad(buffer, at, hz(D2 + 12 + semitone), voice === 0 ? 0.052 : 0.032, chordLength + 1.6);
    }
  }

  // The arpeggio waits eight seconds, so the opening card is nearly bare and
  // the video has somewhere to go.
  const arpStart = 8;
  const step = beat / 2;
  const pattern = [0, 2, 4, 6, 4, 2];

  for (let n = 0; ; n += 1) {
    const when = arpStart + n * step;
    if (when > totalSeconds - 2.5) break;
    const at = Math.floor(when * RATE);

    // Fades in over four seconds and thins out over the last eight, so the
    // end feels like a decision rather than a power cut.
    const rampIn = Math.min(1, (when - arpStart) / 4);
    const rampOut = Math.min(1, (totalSeconds - 2.5 - when) / 8);
    const gain = 0.085 * rampIn * rampOut;
    if (gain <= 0.0015) continue;

    const chordIndex = Math.floor(when / chordLength) % chords.length;
    const root = chords[chordIndex][0];
    const note = degree(pattern[n % pattern.length]) + 24 + root;
    pluck(buffer, at, hz(note), gain, 0.55);

    // A sparse note an octave up, on the off-beats only, for a little light.
    if (n % 6 === 3) pluck(buffer, at, hz(note + 12), gain * 0.35, 0.4);
  }

  // A last root note, left to ring under the closing card.
  pluck(buffer, Math.floor((totalSeconds - 2.4) * RATE), hz(D2 + 12), 0.1, 1.5);
  pad(buffer, Math.floor((totalSeconds - 2.6) * RATE), hz(D2 + 12), 0.05, 2.6);

  return buffer;
}

// ---------------------------------------------------------------------------
// Mix and write
// ---------------------------------------------------------------------------
/** One-pole low pass, run twice: takes the glassiness off the plucks. */
function soften(buffer, cutoff) {
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let channel = 0; channel < CHANNELS; channel += 1) {
      let last = 0;
      for (let i = channel; i < buffer.length; i += CHANNELS) {
        last += alpha * (buffer[i] - last);
        buffer[i] = last;
      }
    }
  }
}

function toWav(buffer) {
  // Normalise with headroom, so it sits under a voiceover if one is ever
  // recorded rather than fighting it.
  let peak = 0;
  for (const sample of buffer) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0 ? 0.5 / peak : 1;

  const frames = buffer.length / CHANNELS;
  const data = Buffer.alloc(buffer.length * 2);
  for (let i = 0; i < buffer.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, buffer[i] * scale));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * CHANNELS * 2, 28);
  header.writeUInt16LE(CHANNELS * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  return { wav: Buffer.concat([header, data]), frames };
}

const mix = arrange(seconds);
soften(mix, 2600);
const { wav, frames } = toWav(mix);
await writeFile(outPath, wav);
console.log(
  `\x1b[36m▸\x1b[0m scored ${(frames / RATE).toFixed(1)}s → ${outPath} (${(wav.length / 1_048_576).toFixed(1)} MB)`,
);
