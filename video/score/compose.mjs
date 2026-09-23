/**
 * The score, written rather than licensed — and Indian rather than merely warm.
 *
 * The first version was a D major pentatonic pad with a bell on it. Pleasant,
 * and the wrong continent: a video about a Ganesh Chaturthi fund should not
 * sound like a Scandinavian banking advert. This one is built from the things
 * that actually make music sound Indian, rather than from a scale that happens
 * to have five notes.
 *
 *   Raga Hamsadhwani — Sa Re Ga Pa Ni, the same five notes up and down. It is
 *   the raga of Ganesh invocation (Vatapi Ganapatim is in it), which is the
 *   festival this video is about, and it is bright rather than plaintive.
 *
 *   Just intonation, not equal temperament. Re is 9/8 of Sa and Ga is 5/4,
 *   exact small-number ratios rather than twelfth-roots of two. It is why a
 *   tanpura rings instead of beating, and it is audible even when nobody can
 *   say what they are hearing.
 *
 *   A tanpura underneath, all the way through. Four strings — Pa, Sa, Sa, Sa
 *   an octave down — plucked in a slow rotation, each ringing for six seconds
 *   over the next. The jawari bridge holds its high partials up long after the
 *   fundamental has faded, which is the shimmer; it is not a buzz, and an
 *   earlier cut of this file mistook the two.
 *
 *   Meend on the melody. An Indian phrase slides into its notes rather than
 *   stepping onto them; a bansuri line quantised to note boundaries is a
 *   flute playing a Western tune.
 *
 *   Keherwa, the eight-beat cycle, on a tabla rather than a drum kit — bass
 *   strokes that bend in pitch, treble strokes that ring. Mixed low, because
 *   the bed's job is still to stay out of the way of the captions.
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
// The raga
// ---------------------------------------------------------------------------
/** Sa, low enough to sit under speech. Everything else is a ratio of it. */
const SA = 146.83;

/**
 * Hamsadhwani, in just intonation: Sa, Re (9/8), Ga (5/4), Pa (3/2), Ni (15/8).
 *
 * Equal temperament would put Ga 14 cents flat and Ni 12 cents sharp of these,
 * which over a six-second tanpura note is a slow beating the ear reads as
 * out-of-tune rather than as a different tuning system.
 */
const RATIO = [1, 9 / 8, 5 / 4, 3 / 2, 15 / 8];

/** Degree 0 is Sa; 5 is Sa an octave up; -1 is Ni below. */
function note(degree) {
  const octave = Math.floor(degree / RATIO.length);
  const step = ((degree % RATIO.length) + RATIO.length) % RATIO.length;
  return SA * RATIO[step] * 2 ** octave;
}

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------
/**
 * One tanpura string.
 *
 * What makes a tanpura a tanpura is the jawari bridge, which holds the high
 * partials up long after the fundamental has gone — so the levels and decay
 * rates below matter more than the tuning. The partials are a few cents sharp
 * of whole numbers, which is what a real stiff string does; an earlier cut
 * stretched them far harder on the theory that the buzz was the point, and
 * that overstated it.
 */
function tanpura(buffer, atSample, freq, gain) {
  const decay = 3.4;
  const length = Math.floor(6.2 * RATE);
  const partials = [
    { ratio: 1, level: 1, decay: 1 },
    { ratio: 2.001, level: 0.62, decay: 1.25 },
    { ratio: 3.003, level: 0.4, decay: 1.55 },
    { ratio: 4.006, level: 0.26, decay: 1.9 },
    { ratio: 5.01, level: 0.15, decay: 2.3 },
    { ratio: 6.015, level: 0.08, decay: 2.8 },
    { ratio: 7.02, level: 0.04, decay: 3.3 },
  ];

  for (let i = 0; i < length; i += 1) {
    const at = atSample + i;
    if (at >= buffer.length / CHANNELS) break;
    const t = i / RATE;
    const attack = Math.min(1, t / 0.012);
    let sample = 0;
    for (const p of partials) {
      sample +=
        p.level * Math.sin(2 * Math.PI * freq * p.ratio * t) * Math.exp(-t / (decay / p.decay));
    }
    const value = sample * gain * attack;
    buffer[at * CHANNELS] += value * 0.97;
    buffer[at * CHANNELS + 1] += value * 1.03;
  }
}

/**
 * Deterministic noise, for the bansuri's breath.
 *
 * The first version of this reached for the GLSL hash `fract(sin(x) * 43758.5)`
 * and fed it the sample index. That is not noise. A hash needs unrelated inputs
 * to look random; given a smoothly increasing one it comes back as a structured
 * full-scale signal — measurably periodic (autocorrelation 0.55 one sample out,
 * -0.66 seven samples out, where noise is ~0) and concentrated around 3.2 kHz,
 * which is close to where human hearing is most sensitive. It was audible as a
 * metallic buzz under the whole piece.
 *
 * So: an actual generator with state, low-passed to about 1.9 kHz so it reads
 * as air moving over an edge rather than as hiss. Seeded per note, so a note
 * rendered twice is the same note twice.
 */
function breathing(seed) {
  // xorshift32 needs a non-zero state; sample 0 would otherwise stay silent.
  let state = (seed | 1) >>> 0;
  let low = 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    low += 0.22 * (state / 2 ** 31 - 1 - low);
    return low;
  };
}

/**
 * A bansuri phrase: one breathy tone that slides into pitch rather than
 * arriving on it. `from` is the degree it glides out of — that meend is what
 * makes a line sound played rather than typed.
 */
function bansuri(buffer, atSample, fromDegree, toDegree, lengthSeconds, gain) {
  const length = Math.floor(lengthSeconds * RATE);
  const glide = Math.min(0.18, lengthSeconds * 0.35);
  const start = note(fromDegree);
  const end = note(toDegree);
  let phase = 0;
  const air = breathing(atSample);

  for (let i = 0; i < length; i += 1) {
    const at = atSample + i;
    if (at >= buffer.length / CHANNELS) break;
    const t = i / RATE;
    // Ease the slide, so it leaves quickly and settles slowly.
    const slide = Math.min(1, t / glide);
    const eased = 1 - (1 - slide) ** 3;
    // Vibrato only once the note has arrived; a wobbling glide sounds seasick.
    const vibrato = 1 + Math.sin(2 * Math.PI * 5.4 * t) * 0.004 * eased;
    const freq = (start + (end - start) * eased) * vibrato;
    phase += (2 * Math.PI * freq) / RATE;

    const envelope =
      Math.min(1, t / 0.05) * Math.min(1, (lengthSeconds - t) / 0.22) * Math.exp(-t * 0.12);
    // A flute is nearly a sine with a little second harmonic and some air.
    const tone = Math.sin(phase) + 0.14 * Math.sin(phase * 2) + 0.05 * Math.sin(phase * 3);
    const value = (tone + air() * 0.06) * gain * envelope;
    buffer[at * CHANNELS] += value;
    buffer[at * CHANNELS + 1] += value;
  }
}

/** The baya: the tabla's bass, whose pitch bends down as the hand slides. */
function baya(buffer, atSample, gain) {
  const length = Math.floor(0.55 * RATE);
  for (let i = 0; i < length; i += 1) {
    const at = atSample + i;
    if (at >= buffer.length / CHANNELS) break;
    const t = i / RATE;
    const pitch = 104 * Math.exp(-t * 9) + 58;
    const value = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t / 0.16) * gain;
    buffer[at * CHANNELS] += value * 1.04;
    buffer[at * CHANNELS + 1] += value * 0.96;
  }
}

/** The dayan: the treble drum, tuned to Sa and ringing rather than thudding. */
function dayan(buffer, atSample, gain, open = false) {
  const length = Math.floor((open ? 0.4 : 0.14) * RATE);
  const decay = open ? 0.13 : 0.035;
  for (let i = 0; i < length; i += 1) {
    const at = atSample + i;
    if (at >= buffer.length / CHANNELS) break;
    const t = i / RATE;
    // A tabla's treble head is tuned, and its overtones are close to harmonic
    // — which is why it carries pitch where a snare does not.
    const value =
      (Math.sin(2 * Math.PI * SA * 2 * t) +
        0.5 * Math.sin(2 * Math.PI * SA * 3.01 * t) +
        0.3 * Math.sin(2 * Math.PI * SA * 4.02 * t)) *
      Math.exp(-t / decay) *
      gain;
    buffer[at * CHANNELS] += value * 0.94;
    buffer[at * CHANNELS + 1] += value * 1.06;
  }
}

// ---------------------------------------------------------------------------
// Arrangement
// ---------------------------------------------------------------------------
/** Slow enough to read a ledger over. Keherwa is eight of these. */
const BPM = 82;
const beat = 60 / BPM;
const CYCLE = beat * 8;

/**
 * Keherwa: dha ge na ti / na ke dhi na. Bass on 1 and 5, treble through the
 * rest, and the two together on the sam — the first beat, which is the one
 * everything resolves onto.
 */
const KEHERWA = [
  { at: 0, bass: true, treble: true, open: true },
  { at: 1, treble: true },
  { at: 2, treble: true, open: true },
  { at: 3, treble: true },
  { at: 4, bass: true, treble: true, open: true },
  { at: 5, treble: true },
  { at: 6, bass: true, treble: true },
  { at: 7, treble: true },
];

/** A phrase is a run of degrees; the melody walks the raga rather than jumps. */
const PHRASES = [
  [0, 1, 2, 3],
  [4, 3, 2, 1],
  [2, 3, 4, 5],
  [4, 3, 1, 0],
  [0, 2, 3, 4],
  [3, 2, 1, 0],
];

function arrange(totalSeconds) {
  const frames = Math.ceil(totalSeconds * RATE);
  const buffer = new Float64Array(frames * CHANNELS);

  // ---- tanpura, all the way through -------------------------------------
  // Pa, Sa, Sa, and Sa an octave down: the standard four, in that rotation.
  const strings = [note(3) / 2, SA, SA, SA / 2];
  const pluck = CYCLE / 4;
  for (let index = 0; index * pluck < totalSeconds; index += 1) {
    const when = index * pluck;
    // Fades in over the first bar and away under the last, so the drone is
    // there before anything else and outlasts everything else.
    const rampIn = Math.min(1, when / 3.5);
    const rampOut = Math.min(1, (totalSeconds - when) / 4);
    const gain = 0.05 * rampIn * rampOut;
    if (gain > 0.002) tanpura(buffer, Math.floor(when * RATE), strings[index % 4], gain);
  }

  // ---- tabla, once the piece has settled --------------------------------
  const tablaFrom = 7.5;
  for (let cycle = 0; cycle * CYCLE < totalSeconds; cycle += 1) {
    for (const stroke of KEHERWA) {
      const when = cycle * CYCLE + stroke.at * beat;
      if (when < tablaFrom || when > totalSeconds - 2.5) continue;
      const rampIn = Math.min(1, (when - tablaFrom) / 4);
      const rampOut = Math.min(1, (totalSeconds - 2.5 - when) / 6);
      const level = rampIn * rampOut;
      if (level <= 0.02) continue;
      if (stroke.bass) baya(buffer, Math.floor(when * RATE), 0.05 * level);
      if (stroke.treble) dayan(buffer, Math.floor(when * RATE), 0.026 * level, stroke.open);
    }
  }

  // ---- bansuri, after the drone has established the tonic ---------------
  const melodyFrom = 4;
  let when = melodyFrom;
  let phraseIndex = 0;
  let previous = 0;
  while (when < totalSeconds - 3) {
    const phrase = PHRASES[phraseIndex % PHRASES.length];
    phraseIndex += 1;
    for (const degree of phrase) {
      if (when > totalSeconds - 3) break;
      const length = beat * (degree === phrase[phrase.length - 1] ? 2.2 : 1.1);
      const rampIn = Math.min(1, (when - melodyFrom) / 4);
      const rampOut = Math.min(1, (totalSeconds - 3 - when) / 7);
      const gain = 0.11 * rampIn * rampOut;
      if (gain > 0.004) {
        bansuri(buffer, Math.floor(when * RATE), previous, degree, length * 0.96, gain);
      }
      previous = degree;
      when += length;
    }
    // A breath between phrases, which is also how a bansuri player works.
    when += beat * 0.9;
  }

  // ---- the close: back to Sa, left to ring -------------------------------
  bansuri(buffer, Math.floor((totalSeconds - 2.9) * RATE), previous, 0, 2.6, 0.1);
  tanpura(buffer, Math.floor((totalSeconds - 2.8) * RATE), SA, 0.06);

  return buffer;
}

// ---------------------------------------------------------------------------
// Mix and write
// ---------------------------------------------------------------------------
/** One-pole low pass, run twice: takes the glassiness off the synthesis. */
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
soften(mix, 3200);
const { wav, frames } = toWav(mix);
await writeFile(outPath, wav);
console.log(
  `\x1b[36m▸\x1b[0m scored ${(frames / RATE).toFixed(1)}s of Hamsadhwani → ${outPath} (${(wav.length / 1_048_576).toFixed(1)} MB)`,
);
