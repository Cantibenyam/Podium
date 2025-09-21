import { createAvatar } from '@dicebear/core';
import { micah, avataaars } from '@dicebear/collection';
import type { Options as MicahOptions } from '@dicebear/micah';
import type { Options as AvataaarsOptions } from '@dicebear/avataaars';

export type Emotion =
  | 'happy'
  | 'excited'
  | 'calm'
  | 'attentive'
  | 'skeptical'
  | 'confused'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'bored';

export type Persona = {
  id: string;
  style: 'micah' | 'avataaars';
  /** Your app-level metadata (not passed to DiceBear styles) */
  gender?: 'male' | 'female';
  accessoriesProbability?: number; // 0..100 (your app can use this as needed)
  facialHairProbability?: number;  // 0..100
};

// ---------- Public API ----------

/** Render a persona avatar as SVG text with the given emotion. */
export function renderPersonaAvatar(p: Persona, emotion: Emotion): string {
  const seed = `${p.id}:${emotion}`;

  if (p.style === 'avataaars') {
    const r = avataaarsEmotionMap[emotion];
    const opts: Partial<AvataaarsOptions> = {
      // Focus on face parts we control for expression;
      // Add additional fixed styling here if you want (top, accessories, etc.)
      eyes: r.eyes,
      eyebrows: r.eyebrows,
      mouth: r.mouth,
    };
    return renderAvatarSVG('avataaars', seed, opts);
  }

  // Micah: map emotion hints to actual options available in the schema
  const opts = buildMicahOptions(emotion);
  return renderAvatarSVG('micah', seed, opts);
}

// ---------- Style-specific rendering (typed overloads) ----------

export function renderAvatarSVG(
  style: 'micah',
  seed: string,
  options?: Partial<MicahOptions>
): string;
export function renderAvatarSVG(
  style: 'avataaars',
  seed: string,
  options?: Partial<AvataaarsOptions>
): string;
export function renderAvatarSVG(
  style: 'micah' | 'avataaars',
  seed: string,
  options: Record<string, unknown> = {}
): string {
  const impl = style === 'micah' ? micah : avataaars;
  // The overloads give good DX for callers; we erase generics at the call site to avoid union clashes.
  return createAvatar(impl as any, { seed, ...(options as any) }).toString();
}

// ---------- Avataaars emotion recipes (use only valid option names) ----------
// Reference-safe sets (subset of the full style to stay compatible across versions).
type AvKeys = Required<Pick<AvataaarsOptions, 'eyes' | 'eyebrows' | 'mouth'>>;
const avataaarsEmotionMap: Record<Emotion, AvKeys> = {
  happy: {
    eyes: ['happy', 'wink', 'winkWacky'],
    eyebrows: ['raisedExcited', 'raisedExcitedNatural', 'upDown'],
    mouth: ['smile', 'default'],
  },
  excited: {
    eyes: ['surprised', 'happy'],
    eyebrows: ['raisedExcited', 'raisedExcitedNatural'],
    mouth: ['screamOpen', 'smile'],
  },
  calm: {
    eyes: ['default', 'closed'],
    eyebrows: ['defaultNatural', 'flatNatural'],
    mouth: ['default', 'serious'],
  },
  attentive: {
    eyes: ['default', 'happy'],
    eyebrows: ['upDown', 'upDownNatural', 'raisedExcitedNatural'],
    mouth: ['default', 'serious'],
  },
  skeptical: {
    eyes: ['eyeRoll', 'squint'],
    eyebrows: ['frownNatural', 'angryNatural'],
    mouth: ['serious', 'disbelief'],
  },
  confused: {
    eyes: ['squint', 'closed'],
    eyebrows: ['sadConcerned', 'sadConcernedNatural'],
    mouth: ['grimace', 'disbelief'],
  },
  sad: {
    eyes: ['closed', 'eyeRoll'],
    eyebrows: ['sadConcerned', 'sadConcernedNatural'],
    mouth: ['sad', 'serious'],
  },
  angry: {
    eyes: ['squint', 'closed'],
    eyebrows: ['angryNatural', 'frownNatural', 'angry'],
    mouth: ['serious', 'grimace'],
  },
  surprised: {
    eyes: ['surprised', 'happy'],
    eyebrows: ['raisedExcited', 'raisedExcitedNatural'],
    mouth: ['screamOpen', 'disbelief'],
  },
  bored: {
    eyes: ['default', 'eyeRoll', 'closed'],
    eyebrows: ['flatNatural', 'defaultNatural', 'sadConcerned', 'sadConcernedNatural'],
    mouth: ['serious', 'default'],
  },
};

// ---------- Micah mapping (schema-aware “closest match”) ----------

/**
 * Robustly pull the enum values for a given option from the style schema.
 * Micah schema sometimes nests under `properties[key].items.enum` or similar.
 */
function enumFromSchema(style: any, key: string): string[] {
  const p = style?.schema?.properties?.[key];
  // Try several common shapes
  return (
    p?.items?.enum ??
    p?.enum ??
    (Array.isArray(p?.oneOf) ? p.oneOf.map((x: any) => x?.const ?? x?.title).filter(Boolean) : []) ??
    []
  );
}

/** Case-insensitive substring "closest" match: picks the first allowed value that includes any hint. */
function pickClosest(allowed: string[] = [], hints: string[]): string | undefined {
  const hay = allowed.map((v) => v.toLowerCase());
  for (const hint of hints.map((h) => h.toLowerCase())) {
    const idx = hay.findIndex((v) => v.includes(hint));
    if (idx >= 0) return allowed[idx];
  }
  return undefined;
}

/** Build Micah options for an emotion using available schema enums. */
function buildMicahOptions(emotion: Emotion): Partial<MicahOptions> {
  const eyesVals = enumFromSchema(micah as any, 'eyes');
  const browVals = enumFromSchema(micah as any, 'eyebrows');
  const mouthVals = enumFromSchema(micah as any, 'mouth');

  // Hints are intentionally generic; pickClosest chooses a valid actual value from the schema.
  const hints: Record<Emotion, { eyes: string[]; brows: string[]; mouth: string[] }> = {
    happy:      { eyes: ['round', 'eyes'],          brows: ['raised', 'up'],  mouth: ['smile', 'grin'] },
    excited:    { eyes: ['round', 'eyes'],          brows: ['raised'],        mouth: ['laugh', 'open'] },
    calm:       { eyes: ['eyesShadow', 'eyes'],     brows: ['neutral'],       mouth: ['neutral']       },
    attentive:  { eyes: ['round', 'eyes'],          brows: ['raised', 'up'],  mouth: ['neutral']       },
    skeptical:  { eyes: ['eyesShadow','eyes'],      brows: ['down'],          mouth: ['smirk','flat']  },
    confused:   { eyes: ['eyesShadow','eyes'],      brows: ['down','concern'],mouth: ['flat','open']   },
    sad:        { eyes: ['eyesShadow','eyes'],      brows: ['down','concern'],mouth: ['sad','frown']   },
    angry:      { eyes: ['eyesShadow','eyes'],      brows: ['down'],          mouth: ['frown','flat']  },
    surprised:  { eyes: ['round', 'eyes'],          brows: ['raised'],        mouth: ['open','o']      },
    bored:      { eyes: ['eyesShadow','eyes'],      brows: ['down'],          mouth: ['sad','frown']   },
  };

  const target = hints[emotion];

  const eyes = pickClosest(eyesVals, target.eyes);
  const eyebrows = pickClosest(browVals, target.brows);
  const mouth = pickClosest(mouthVals, target.mouth);

  const out: Partial<MicahOptions> = {};
  if (eyes) out.eyes = [eyes as any];
  if (eyebrows) out.eyebrows = [eyebrows as any];
  if (mouth) out.mouth = [mouth as any];
  return out;
}

// ---------- Example (remove in production) ----------
// const svg = renderPersonaAvatar({ id: 'demo-1', style: 'avataaars' }, 'happy');
// console.log(svg);
