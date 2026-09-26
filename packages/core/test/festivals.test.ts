import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FESTIVAL,
  FESTIVALS,
  festivalById,
  festivalFor,
  headingTowards,
} from '../src/festivals';

describe('festivalFor', () => {
  it('reads the event type first, because that is what the society filed it as', () => {
    // The name says nothing; the type is the society's own answer.
    expect(festivalFor('Deepavali', 'Block A celebration').id).toBe('deepavali');
  });

  it('falls back to the name, which is where a specific evening shows up', () => {
    // "Dandiya night" under a generic "Festival" type is still Dasara.
    expect(festivalFor('Festival', 'Dandiya night').id).toBe('dasara');
  });

  it('is case- and spelling-tolerant across the names one festival goes by', () => {
    for (const spelling of ['Diwali 2026', 'DEEPAVALI', 'dipavali mela']) {
      expect(festivalFor(null, spelling).id).toBe('deepavali');
    }
  });

  it('leaves everything that is not a festival in the society’s own colour', () => {
    expect(festivalFor('Meeting', 'Terrace waterproofing fund').id).toBe('community');
    expect(festivalFor(null, null).id).toBe('community');
    expect(festivalFor('', '   ').id).toBe('community');
  });

  it('never returns something the UI cannot paint', () => {
    for (const festival of FESTIVALS) {
      expect(festival.accent).toHaveLength(2);
      expect(festival.ribbon).toHaveLength(2);
      expect(festival.wash).toHaveLength(2);
      expect(festival.petals).toBeGreaterThan(2);
      for (const value of [...festival.accent, ...festival.ribbon, ...festival.wash]) {
        expect(value).toMatch(/^oklch\(/);
      }
    }
  });

  it('gives every festival a keyword except the fallback', () => {
    for (const festival of FESTIVALS) {
      if (festival.id === DEFAULT_FESTIVAL.id) expect(festival.match).toHaveLength(0);
      else expect(festival.match.length).toBeGreaterThan(0);
    }
  });

  it('claims no keyword twice, so the first match is the only match', () => {
    const seen = new Map<string, string>();
    for (const festival of FESTIVALS) {
      for (const word of festival.match) {
        expect(seen.get(word), `"${word}" is claimed twice`).toBeUndefined();
        seen.set(word, festival.id);
      }
    }
  });
});

describe('festivalById', () => {
  it('round-trips a stored id', () => {
    expect(festivalById('holi').label).toBe('Holi');
  });

  it('treats an unknown or missing id as the society’s own', () => {
    expect(festivalById('lunar-new-year').id).toBe('community');
    expect(festivalById(null).id).toBe('community');
    expect(festivalById(undefined).id).toBe('community');
  });
});

describe('headingTowards', () => {
  it('names the festival when the event is one', () => {
    const diwali = festivalFor('Diwali Mela 2026');
    expect(headingTowards(diwali, 'Diwali Mela 2026')).toBe(diwali.label);
  });

  it('names the event itself when it is not a festival, never the palette', () => {
    expect(headingTowards(festivalFor('Velocity vipers'), 'Velocity vipers')).toBe(
      'Velocity vipers',
    );
    expect(headingTowards(DEFAULT_FESTIVAL, 'Velocity vipers')).not.toBe(DEFAULT_FESTIVAL.label);
  });
});
