import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FESTIVAL,
  FESTIVALS,
  MOTIFS,
  contrastRatio,
  festivalById,
  festivalFor,
  headingTowards,
  heroGradient,
  parseOklch,
} from '../src';

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
  it('names the festival when the event is one, as the calendar spells it', () => {
    expect(headingTowards(festivalFor('Diwali Mela 2026'), 'Diwali Mela 2026')).toBe('Diwali');
    // One look dresses Baisakhi and Bihu; the heading still says which.
    expect(headingTowards(festivalFor('Baisakhi 2027'), 'Baisakhi 2027')).toBe('Baisakhi');
    expect(headingTowards(festivalFor('Navroz'), 'Navroz')).toBe('Navroz');
  });

  it('falls back to the look’s name when the event’s own name does not say', () => {
    // Filed under the Deepavali type, named for the block.
    const deepavali = festivalFor('Deepavali', 'Block A celebration');
    expect(headingTowards(deepavali, 'Block A celebration')).toBe('Deepavali');
  });

  it('names an occasion by the event, never by its look', () => {
    expect(headingTowards(festivalFor('Cricket league'), 'Cricket league')).toBe('Cricket league');
  });

  it('names the event itself when it is not a festival, never the palette', () => {
    expect(headingTowards(festivalFor('Velocity vipers'), 'Velocity vipers')).toBe(
      'Velocity vipers',
    );
    expect(headingTowards(DEFAULT_FESTIVAL, 'Velocity vipers')).not.toBe(DEFAULT_FESTIVAL.label);
  });
});

describe('a look for every faith, the nation and the society’s own occasions', () => {
  const lookOf = (name: string) => festivalFor(null, name);

  it('dresses each faith’s festival in its own things', () => {
    expect(lookOf('Deepavali 2026').motif).toBe('diya');
    expect(lookOf('Eid-ul-Fitr get-together').motif).toBe('crescent');
    expect(lookOf('Bakrid 2027').id).toBe('eid');
    expect(lookOf('Christmas carols').motif).toBe('star');
    expect(lookOf('Easter Sunday brunch').motif).toBe('lily');
    expect(lookOf('Guru Nanak Jayanti').motif).toBe('lights');
    expect(lookOf('Buddha Purnima').id).toBe('buddha');
    expect(lookOf('Mahavir Jayanti').id).toBe('mahavir');
    expect(lookOf('Navroz').motif).toBe('toran');
    expect(lookOf('Onam sadhya').motif).toBe('pookalam');
    expect(lookOf('Holi 2027').motif).toBe('gulal');
  });

  it('never hangs one faith’s decoration on another’s festival', () => {
    const hindu = new Set(['diya', 'toran', 'kolam', 'garland', 'modak', 'pot', 'rakhi']);
    for (const name of ['Eid', 'Christmas', 'Easter', 'Buddha Purnima', 'Guru Nanak Jayanti']) {
      expect(hindu.has(lookOf(name).motif), name).toBe(false);
    }
  });

  it('gives the national days three bands of colour, on navy', () => {
    for (const name of ['Independence Day', 'Republic Day flag hoisting']) {
      expect(lookOf(name).motif).toBe('tricolour');
    }
    const [, , hue] = parseOklch(heroGradient(lookOf('Republic Day'))[1]);
    expect(hue).toBeGreaterThan(250);
    expect(lookOf('Gandhi Jayanti').motif).toBe('charkha');
    expect(lookOf('Gandhi Jayanti').mood).toBe('calm');
  });

  it('tells regional festivals apart', () => {
    expect(lookOf('Chhath Puja').id).toBe('chhath');
    expect(lookOf('Durga Puja').id).toBe('dasara');
    expect(lookOf('Saraswati Puja').id).toBe('puja');
    expect(lookOf('Telugu New Year').id).toBe('ugadi');
    expect(lookOf('Bathukamma').id).toBe('bathukamma');
    expect(lookOf('Makar Sankranti kite flying').motif).toBe('kite');
    expect(lookOf('Lohri bonfire').motif).toBe('bonfire');
  });

  it('dresses the occasions that are not festivals', () => {
    expect(lookOf('Cricket tournament').motif).toBe('trophy');
    expect(lookOf('Music night').motif).toBe('music');
    expect(lookOf('Children’s Day').motif).toBe('balloons');
    expect(lookOf('Blood donation camp').motif).toBe('heart');
    expect(lookOf('Tree plantation drive').motif).toBe('leaf');
    expect(lookOf('Potluck dinner').motif).toBe('thali');
    expect(lookOf('Society anniversary').motif).toBe('confetti');
  });
});

describe('grief', () => {
  it('is never dressed as a celebration', () => {
    for (const name of ['Condolence meeting', 'Muharram', 'Good Friday service']) {
      const look = festivalFor(null, name);
      expect(look.id, name).toBe('remembrance');
      expect(look.motif).toBe('none');
      expect(look.mood).toBe('solemn');
    }
  });

  it('outranks the type the event was filed under', () => {
    expect(festivalFor('Cultural', 'Prayer meeting for Mr Rao').id).toBe('remembrance');
  });
});

describe('keywords', () => {
  it('match whole words, not the middle of a name', () => {
    expect(festivalFor(null, 'Reid Hall renovation').id).toBe('community');
    expect(festivalFor(null, 'Greenfield block AGM').id).toBe('community');
    expect(festivalFor(null, 'Krishna Towers lift repair').id).toBe('community');
  });

  it('still find a festival run into its year', () => {
    expect(festivalFor(null, 'Diwali2026').id).toBe('deepavali');
  });

  it('put the festival ahead of the occasion it is held as', () => {
    expect(festivalFor(null, 'Diwali cricket match').id).toBe('deepavali');
    expect(festivalFor(null, 'Independence Day celebration').id).toBe('national');
    expect(festivalFor(null, 'New Year’s Eve party').id).toBe('newyear');
    expect(festivalFor(null, 'Health camp').id).toBe('care');
    expect(festivalFor(null, 'Food fest').id).toBe('food');
  });
});

describe('every look', () => {
  it('names a motif that exists, and a festive one moves', () => {
    for (const festival of FESTIVALS) {
      const motif = MOTIFS[festival.motif];
      expect(motif, festival.id).toBeDefined();
      if (festival.mood === 'festive') {
        expect(
          motif.layers.some((layer) => layer.motion),
          festival.id,
        ).toBe(true);
      }
    }
  });

  it('puts white text on a banner dark enough to read', () => {
    for (const festival of FESTIVALS) {
      const [glow, middle, deep] = heroGradient(festival);
      expect(contrastRatio('oklch(1 0 0)', middle), festival.id).toBeGreaterThanOrEqual(4.5);
      expect(parseOklch(deep)[0]).toBeLessThan(parseOklch(middle)[0]);
      expect(parseOklch(middle)[0]).toBeLessThan(parseOklch(glow)[0]);
    }
  });
});
