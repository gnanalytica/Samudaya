import { describe, expect, it } from 'vitest';
import { MOTIFS, motifLayers, motifViewBox, oklchToHex, contrastRatio } from '../src';

describe('motifs', () => {
  it('are drawn in paths both apps can read', () => {
    for (const motif of Object.values(MOTIFS)) {
      for (const layer of motif.layers) {
        for (const path of layer.paths) {
          expect(path.d, motif.id).toMatch(/^M-?[\d.]/);
          expect(path.d, motif.id).not.toMatch(/NaN|undefined/);
          for (const paint of [path.fill, path.stroke]) {
            if (paint?.startsWith('#')) expect(paint).toMatch(/^#[0-9a-f]{6}$/);
          }
        }
      }
    }
  });

  it('move each moving part about a point on the canvas', () => {
    for (const motif of Object.values(MOTIFS)) {
      for (const layer of motif.layers) {
        if (!layer.motion) continue;
        expect(layer.origin, motif.id).toBeDefined();
        const [x, y] = layer.origin!;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(120);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(120);
      }
    }
  });

  it('never leave a small tile empty', () => {
    for (const motif of Object.values(MOTIFS)) {
      if (motif.id === 'none') continue;
      expect(motifLayers(motif.id, true).length, motif.id).toBeGreaterThan(0);
    }
  });

  it('frame a tile only where the drawing would otherwise be a speck', () => {
    expect(motifViewBox('diya', true)).toBe('0 0 120 120');
    expect(motifViewBox('lights', true)).not.toBe('0 0 120 120');
    expect(motifViewBox('lights')).toBe('0 0 120 120');
  });

  it('paint the national days in the tricolour’s own colours', () => {
    const fills = MOTIFS.tricolour.layers.flatMap((layer) => layer.paths.map((path) => path.fill));
    expect(fills).toEqual(expect.arrayContaining(['#ff9933', '#ffffff', '#138808']));
  });

  it('draw nothing at all for a day of mourning', () => {
    expect(MOTIFS.none.layers).toHaveLength(0);
  });

  /**
   * Candy colours — pink powder, rainbow tiers, red and blue balloons — are
   * what made a festival look drawn for children. Every drawing is a line, a
   * wash and one gold light; the banner behind it carries the colour.
   */
  it('are drawn in one hand: line, wash and gold, the tricolour apart', () => {
    const paints = new Set(['line', 'soft', 'light', undefined]);
    const coloured = Object.values(MOTIFS)
      .filter((motif) => motif.id !== 'tricolour')
      .flatMap((motif) =>
        motif.layers.flatMap((layer) =>
          layer.paths
            .filter((path) => !paints.has(path.fill) || !paints.has(path.stroke))
            .map((path) => `${motif.id}: ${path.fill ?? path.stroke}`),
        ),
      );
    expect(coloured).toEqual([]);
  });
});

describe('colour', () => {
  it('converts oklch to the hex the phone needs', () => {
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000');
    expect(oklchToHex('oklch(0.628 0.2577 29.23)')).toBe('#ff0000');
  });

  it('measures contrast the way WCAG does', () => {
    expect(contrastRatio('oklch(1 0 0)', 'oklch(0 0 0)')).toBeCloseTo(21, 1);
  });
});
