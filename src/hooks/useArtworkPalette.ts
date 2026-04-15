import { useState, useEffect } from "react";
import type { PaletteColors } from "../types/lastfm";

const DEFAULT_PALETTE: PaletteColors = {
  dominant: "#404040",
  muted: "#262626",
  vibrant: "#525252",
  light: "#737373",
  dark: "#171717",
};

// --- Color math ---

interface RGB {
  r: number;
  g: number;
  b: number;
}
interface HSL {
  h: number;
  s: number;
  l: number;
}

function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

function relativeLuminance({ r, g, b }: RGB): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a),
    lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

// --- Median-cut color quantization ---

interface ColorBucket {
  pixels: RGB[];
}

function channelRange(pixels: RGB[], ch: "r" | "g" | "b"): number {
  let min = 255,
    max = 0;
  for (const p of pixels) {
    if (p[ch] < min) min = p[ch];
    if (p[ch] > max) max = p[ch];
  }
  return max - min;
}

function medianCut(pixels: RGB[], depth: number): ColorBucket[] {
  if (depth === 0 || pixels.length <= 1) return [{ pixels }];

  // Find channel with widest range
  const rRange = channelRange(pixels, "r");
  const gRange = channelRange(pixels, "g");
  const bRange = channelRange(pixels, "b");
  const ch =
    rRange >= gRange && rRange >= bRange ? "r" : gRange >= bRange ? "g" : "b";

  // Sort by that channel and split at median
  pixels.sort((a, b) => a[ch] - b[ch]);
  const mid = Math.floor(pixels.length / 2);

  return [
    ...medianCut(pixels.slice(0, mid), depth - 1),
    ...medianCut(pixels.slice(mid), depth - 1),
  ];
}

function bucketAverage(bucket: ColorBucket): RGB {
  let r = 0,
    g = 0,
    b = 0;
  for (const p of bucket.pixels) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  const n = bucket.pixels.length || 1;
  return { r: r / n, g: g / n, b: b / n };
}

// --- Palette selection with color theory ---

function extractFromCanvas(img: HTMLImageElement): PaletteColors {
  const canvas = document.createElement("canvas");
  const size = 80;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return DEFAULT_PALETTE;

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  // Collect pixels, skip near-black and near-white (not interesting)
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2],
      a = data[i + 3];
    if (a < 128) continue; // skip transparent
    const l = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    if (l > 0.03 && l < 0.97) pixels.push({ r, g, b });
  }

  if (pixels.length < 10) return DEFAULT_PALETTE;

  // Median-cut into 16 buckets, then pick roles
  const buckets = medianCut([...pixels], 4);
  const quantized = buckets
    .filter((b) => b.pixels.length > 0)
    .map((b) => ({
      color: bucketAverage(b),
      count: b.pixels.length,
      hsl: rgbToHsl(bucketAverage(b)),
    }))
    .sort((a, b) => b.count - a.count);

  if (quantized.length === 0) return DEFAULT_PALETTE;

  // --- Assign roles ---

  // Dominant: most frequent color, prefer mid-lightness
  const dominant =
    quantized.find((c) => c.hsl.l > 0.1 && c.hsl.l < 0.8) ?? quantized[0];

  // Vibrant: highest saturation with reasonable lightness, prefer different hue from dominant
  const vibrantCandidates = [...quantized]
    .filter((c) => c.hsl.s > 0.15 && c.hsl.l > 0.15 && c.hsl.l < 0.85)
    .sort((a, b) => {
      // Score = saturation * 2 + hue distance from dominant * 0.5
      const aHueDist = Math.min(
        Math.abs(a.hsl.h - dominant.hsl.h),
        1 - Math.abs(a.hsl.h - dominant.hsl.h),
      );
      const bHueDist = Math.min(
        Math.abs(b.hsl.h - dominant.hsl.h),
        1 - Math.abs(b.hsl.h - dominant.hsl.h),
      );
      return b.hsl.s * 2 + bHueDist * 0.5 - (a.hsl.s * 2 + aHueDist * 0.5);
    });
  const vibrant = vibrantCandidates[0] ?? dominant;

  // Muted: low saturation, mid lightness, prefer similar hue to dominant
  const muted =
    quantized
      .filter((c) => c.hsl.s < 0.4 && c.hsl.l > 0.1 && c.hsl.l < 0.5)
      .sort((a, b) => a.hsl.s - b.hsl.s)[0] ?? dominant;

  // --- Derive final hex values with adjustments ---

  const vibrantHsl = vibrant.hsl;
  const dominantHsl = dominant.hsl;
  const mutedHsl = muted.hsl;

  // Boost vibrant saturation if it's too washed out
  let vS = vibrantHsl.s;
  let vL = vibrantHsl.l;
  if (vS < 0.4) vS = Math.min(0.7, vS * 2);
  if (vL < 0.3) vL = 0.4;
  if (vL > 0.75) vL = 0.65;
  const vibrantHex = hslToHex({ h: vibrantHsl.h, s: vS, l: vL });

  // Dominant stays close to original but clamped to mid-dark range for backgrounds
  const dominantHex = hslToHex({
    h: dominantHsl.h,
    s: Math.min(0.6, Math.max(0.1, dominantHsl.s)),
    l: Math.max(0.12, Math.min(0.35, dominantHsl.l)),
  });

  // Muted: desaturated, dark-ish
  const mutedHex = hslToHex({
    h: mutedHsl.h,
    s: Math.max(0.05, Math.min(0.25, mutedHsl.s * 0.5)),
    l: Math.max(0.1, Math.min(0.25, mutedHsl.l)),
  });

  // Light: derived from vibrant hue, pushed bright + slightly desaturated for readability
  let lightL = vibrantHsl.l + 0.35;
  if (lightL > 0.85) lightL = 0.85;
  if (lightL < 0.65) lightL = 0.65;
  const lightHex = hslToHex({
    h: vibrantHsl.h,
    s: Math.min(0.65, Math.max(0.2, vibrantHsl.s * 0.8)),
    l: lightL,
  });

  // Dark: dominant hue, very low lightness
  const darkHex = hslToHex({
    h: dominantHsl.h,
    s: Math.max(0.05, dominantHsl.s * 0.3),
    l: 0.06,
  });

  // --- Post-processing: ensure distinctness and contrast ---

  const finalVibrant = hexToRgb(vibrantHex);
  const finalLight = hexToRgb(lightHex);
  const finalDark = hexToRgb(darkHex);

  // Ensure vibrant vs dark has enough contrast (min 3:1)
  let adjustedVibrant = vibrantHex;
  if (contrastRatio(finalVibrant, finalDark) < 3) {
    const vhsl = rgbToHsl(finalVibrant);
    adjustedVibrant = hslToHex({
      h: vhsl.h,
      s: Math.min(0.8, vhsl.s + 0.15),
      l: Math.min(0.7, vhsl.l + 0.15),
    });
  }

  // Ensure light vs dark has enough contrast (min 4.5:1 for text readability)
  let adjustedLight = lightHex;
  if (contrastRatio(finalLight, finalDark) < 4.5) {
    const lhsl = rgbToHsl(finalLight);
    adjustedLight = hslToHex({
      h: lhsl.h,
      s: lhsl.s,
      l: Math.min(0.9, lhsl.l + 0.15),
    });
  }

  // Ensure vibrant and light aren't too similar
  if (colorDistance(hexToRgb(adjustedVibrant), hexToRgb(adjustedLight)) < 60) {
    const lhsl = rgbToHsl(hexToRgb(adjustedLight));
    adjustedLight = hslToHex({
      h: lhsl.h,
      s: Math.max(0.15, lhsl.s - 0.1),
      l: Math.min(0.85, lhsl.l + 0.1),
    });
  }

  return {
    vibrant: adjustedVibrant,
    dominant: dominantHex,
    muted: mutedHex,
    light: adjustedLight,
    dark: darkHex,
  };
}

// --- Vibrant extraction (preferred) with canvas fallback ---

async function extractWithVibrant(proxyUrl: string): Promise<PaletteColors> {
  const mod = await import("node-vibrant/browser");
  // @ts-expect-error it doesn't like this name, but it's prolly fine :)
  const Vibrant = mod.default ?? mod.Vibrant ?? mod;
  const p = await Vibrant.from(proxyUrl).quality(5).getPalette();

  const get = (swatch: { hex?: string } | null | undefined) => swatch?.hex;

  const vibrantHex =
    get(p.Vibrant) ?? get(p.LightVibrant) ?? get(p.DarkVibrant);
  const dominantHex = get(p.DarkVibrant) ?? get(p.Vibrant) ?? get(p.DarkMuted);
  const mutedHex = get(p.Muted) ?? get(p.DarkMuted) ?? get(p.LightMuted);
  const lightHex = get(p.LightVibrant) ?? get(p.LightMuted) ?? get(p.Vibrant);
  const darkHex = get(p.DarkMuted) ?? get(p.DarkVibrant) ?? get(p.Muted);

  if (!vibrantHex || !dominantHex)
    throw new Error("Vibrant returned empty swatches");

  // Post-process for contrast/distinctness
  const vibrantHsl = rgbToHsl(hexToRgb(vibrantHex));
  const lightRaw = lightHex
    ? rgbToHsl(hexToRgb(lightHex))
    : { ...vibrantHsl, l: 0.75 };
  const dominantHsl = rgbToHsl(hexToRgb(dominantHex));
  const mutedRaw = mutedHex
    ? rgbToHsl(hexToRgb(mutedHex))
    : { ...dominantHsl, s: 0.15, l: 0.2 };
  const darkRaw = darkHex
    ? rgbToHsl(hexToRgb(darkHex))
    : { ...dominantHsl, l: 0.06 };

  // Ensure light is actually light
  const finalLight = hslToHex({
    h: lightRaw.h,
    s: Math.min(0.7, Math.max(0.2, lightRaw.s)),
    l: Math.max(0.65, Math.min(0.85, lightRaw.l)),
  });

  // Ensure dark is actually dark
  const finalDark = hslToHex({
    h: darkRaw.h,
    s: Math.max(0.05, darkRaw.s * 0.3),
    l: 0.06,
  });

  // Boost vibrant if too dim
  let vS = vibrantHsl.s,
    vL = vibrantHsl.l;
  if (vS < 0.35) vS = Math.min(0.7, vS * 2);
  if (vL < 0.25) vL = 0.4;
  if (vL > 0.75) vL = 0.65;
  let finalVibrant = hslToHex({ h: vibrantHsl.h, s: vS, l: vL });

  // Contrast checks
  if (contrastRatio(hexToRgb(finalVibrant), hexToRgb(finalDark)) < 3) {
    finalVibrant = hslToHex({
      h: vibrantHsl.h,
      s: Math.min(0.8, vS + 0.15),
      l: Math.min(0.7, vL + 0.15),
    });
  }

  return {
    vibrant: finalVibrant,
    dominant: hslToHex({
      h: dominantHsl.h,
      s: Math.min(0.6, Math.max(0.1, dominantHsl.s)),
      l: Math.max(0.12, Math.min(0.35, dominantHsl.l)),
    }),
    muted: hslToHex({
      h: mutedRaw.h,
      s: Math.max(0.05, Math.min(0.25, mutedRaw.s * 0.5)),
      l: Math.max(0.1, Math.min(0.25, mutedRaw.l)),
    }),
    light: finalLight,
    dark: finalDark,
  };
}

// --- Hook ---

export function useArtworkPalette(imageUrl: string | null) {
  const [palette, setPalette] = useState<PaletteColors>(DEFAULT_PALETTE);
  const [isExtracted, setIsExtracted] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPalette(DEFAULT_PALETTE);
      setIsExtracted(false);
      return;
    }

    const proxyUrl = `/api/artwork?url=${encodeURIComponent(imageUrl)}`;

    // Try node-vibrant/browser first, fall back to canvas extraction
    extractWithVibrant(proxyUrl)
      .then((colors) => {
        setPalette(colors);
        setIsExtracted(true);
      })
      .catch(() => {
        // Vibrant failed — fall back to canvas
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = proxyUrl;
        img.onload = () => {
          try {
            setPalette(extractFromCanvas(img));
            setIsExtracted(true);
          } catch {
            setPalette(DEFAULT_PALETTE);
            setIsExtracted(false);
          }
        };
        img.onerror = () => {
          setPalette(DEFAULT_PALETTE);
          setIsExtracted(false);
        };
      });
  }, [imageUrl]);

  // Apply as CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-dominant", palette.dominant);
    root.style.setProperty("--color-muted", palette.muted);
    root.style.setProperty("--color-vibrant", palette.vibrant);
    root.style.setProperty("--color-light", palette.light);
    root.style.setProperty("--color-dark", palette.dark);
  }, [palette]);

  return { palette, isExtracted };
}
