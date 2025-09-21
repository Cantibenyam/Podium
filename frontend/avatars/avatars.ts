import { createAvatar } from '@dicebear/core';
import { micah, avataaars } from '@dicebear/collection';
import type { Options as MicahOptions } from '@dicebear/micah';
import type { Options as AvataaarsOptions } from '@dicebear/avataaars';

// ---------- Curated Avataaar options ----------

const avataaarsMaleOptions: Partial<AvataaarsOptions> = {
  top: [
    'bun',
    'curly',
    'dreads',
    'dreads01',
    'dreads02',
    'frizzle',
    'fro',
    'froBand',
    'shaggy',
    'shaggyMullet',
    'shavedSides',
    'shortCurly',
    'shortFlat',
    'shortRound',
    'shortWaved',
    'sides',
    'theCaesar',
    'theCaesarAndSidePart',
  ],
  facialHair: ['beardMedium', 'beardLight', 'moustacheFancy', 'moustacheMagnum'],
  clothing: ['blazerAndShirt', 'blazerAndSweater', 'collarAndSweater', 'hoodie', 'shirtCrewNeck'],
  clothingGraphic: ['bat', 'cumbia', 'deer', 'diamond', 'hola', 'pizza', 'resist', 'bear', 'skullOutline', 'skull'],
};

const avataaarsFemaleOptions: Partial<AvataaarsOptions> = {
  top: [
    'bigHair',
    'bob',
    'bun',
    'curly',
    'curvy',
    'straight01',
    'straight02',
    'straightAndStrand',
    'longButNotTooLong',
    'miaWallace',
  ],
  facialHairProbability: 0,
  clothing: ['blazerAndShirt', 'collarAndSweater', 'graphicShirt', 'hoodie', 'shirtScoopNeck', 'shirtVNeck'],
  clothingGraphic: ['bat', 'cumbia', 'deer', 'diamond', 'hola', 'pizza', 'resist', 'bear', 'skullOutline', 'skull'],
};

// ---------- Curated Micah options ----------

const micahMaleOptions: Partial<MicahOptions> = {
  hair: ['dannyPhantom', 'dougFunny', 'fonze', 'mrClean', 'mrT', 'turban'],
  facialHair: ['beard', 'scruff'],
  earringsProbability: 5,
};

const micahFemaleOptions: Partial<MicahOptions> = {
  hair: ['dannyPhantom', 'full', 'pixie', 'turban'],
  facialHairProbability: 0,
  earringsProbability: 75,
};

// ---------- Color Palettes ----------

export const skinColorPalette = ['f2d5d8', 'ddb7a0', 'ce967d', 'bb876f', 'a37761', '8a6652', '715542', '584433'];
export const clothingColorPalette = ['2c3e50', '34495e', '7f8c8d', '95a5a6', 'bdc3c7', 'ecf0f1'];

// ---------- Micah Feature Options ----------

const micahShirtOptions = ['collared', 'crew', 'open'] as const;
const micahEarsOptions = ['attached', 'detached'] as const;

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
  gender?: 'male' | 'female';
  facialHairProbability?: number;
  skinColor?: string[];
  hairColor?: string[];
  ears?: (typeof micahEarsOptions)[number][];
  shirt?: (typeof micahShirtOptions)[number][];
  shirtColor?: string[];
  clothesColor?: string[];
};

// ---------- Public API ----------

export function renderPersonaAvatar(p: Persona, emotion: Emotion): string {
  const seed = p.id;

  if (p.style === 'avataaars') {
    const r = avataaarsEmotionMap[emotion];
    const opts: Partial<AvataaarsOptions> = {
      eyes: r.eyes,
      eyebrows: r.eyebrows,
      mouth: r.mouth,
    };

    if (p.gender === 'male') {
      Object.assign(opts, avataaarsMaleOptions);
      opts.facialHairProbability = p.facialHairProbability ?? 50;
    } else if (p.gender === 'female') {
      Object.assign(opts, avataaarsFemaleOptions);
    }

    opts.accessoriesProbability = 0;

    if (p.skinColor) opts.skinColor = p.skinColor;
    if (p.hairColor) {
      opts.hairColor = p.hairColor;
      opts.facialHairColor = p.hairColor;
    }
    if (p.clothesColor) opts.clothesColor = p.clothesColor;

    return renderAvatarSVG('avataaars', seed, opts);
  }

  const opts = buildMicahOptions(emotion);

  if (p.gender === 'male') {
    Object.assign(opts, micahMaleOptions);
    opts.facialHairProbability = p.facialHairProbability ?? 50;
  } else if (p.gender === 'female') {
    Object.assign(opts, micahFemaleOptions);
  }

  opts.glassesProbability = 0;

  if (p.skinColor) opts.baseColor = p.skinColor;
  if (p.hairColor) {
    opts.hairColor = p.hairColor;
    opts.facialHairColor = p.hairColor;
  }
  if (p.ears) opts.ears = p.ears;
  if (p.shirt) opts.shirt = p.shirt;
  if (p.shirtColor) opts.shirtColor = p.shirtColor;

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
  return createAvatar(impl as any, { seed, ...(options as any) }).toString();
}

type AvKeys = Required<Pick<AvataaarsOptions, 'eyes' | 'eyebrows' | 'mouth'>>;
const avataaarsEmotionMap: Record<Emotion, AvKeys> = {
  happy: {
    eyes: ['happy', 'wink'],
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


function enumFromSchema(style: any, key: string): string[] {
  const p = style?.schema?.properties?.[key];
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

function buildMicahOptions(emotion: Emotion): Partial<MicahOptions> {
  const eyesVals = enumFromSchema(micah as any, 'eyes');
  const browVals = enumFromSchema(micah as any, 'eyebrows');
  const mouthVals = enumFromSchema(micah as any, 'mouth');

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

  const out: Partial<MicahOptions> = {
    eyesColor: ['000000'],
    mouthColor: ['000000'],
  };
  if (eyes) out.eyes = [eyes as any];
  if (eyebrows) out.eyebrows = [eyebrows as any];
  if (mouth) out.mouth = [mouth as any];
  return out;
}

