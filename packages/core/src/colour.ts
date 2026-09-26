/**
 * Just enough colour arithmetic for the festival looks.
 *
 * The looks are written in oklch, like the web's tokens, because lightness is
 * the one number that decides whether text on a colour can be read, and oklch
 * keeps it apart from the hue. The phone cannot read oklch() at all, so every
 * value it needs is converted here to the hex it can.
 */

export type Oklch = readonly [lightness: number, chroma: number, hue: number];

export function parseOklch(color: string): Oklch {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(color);
  if (!match) throw new Error(`Expected an oklch() colour, got ${color}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export const formatOklch = ([lightness, chroma, hue]: Oklch) =>
  `oklch(${Math.round(lightness * 1000) / 1000} ${Math.round(chroma * 1000) / 1000} ${Math.round(((hue % 360) + 360) % 360)})`;

/** Linear sRGB, clipped to what a screen can show. */
function linear([lightness, chroma, hue]: Oklch) {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ] as const;
}

/** An oklch() colour as #rrggbb, for React Native. */
export function oklchToHex(color: string): string {
  const encode = (value: number) =>
    value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  return `#${linear(parseOklch(color))
    .map((value) =>
      Math.round(encode(value) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** WCAG relative luminance. */
export function luminance(color: string) {
  const [red, green, blue] = linear(parseOklch(color));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The WCAG contrast ratio between two oklch() colours, from 1 to 21. */
export function contrastRatio(one: string, other: string) {
  const [light, dark] = [luminance(one), luminance(other)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}
