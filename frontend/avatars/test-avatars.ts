import { writeFileSync, existsSync, mkdirSync } from 'fs';
import {
  renderPersonaAvatar,
  Persona,
  skinColorPalette,
  clothingColorPalette,
} from './avatars';

const outDir = './avatar-tests';
if (!existsSync(outDir)) {
  mkdirSync(outDir);
}

// --- Test Cases ---

const persona1: Persona = {
  id: 'bot-1-samantha',
  style: 'avataaars',
  gender: 'female',
  skinColor: [skinColorPalette[1]],
  hairColor: ['6a4e35'],
  clothesColor: [clothingColorPalette[1]],
};

const persona2: Persona = {
  id: 'bot-2-marcus',
  style: 'micah',
  gender: 'female',
  skinColor: [skinColorPalette[6]],
  hairColor: ['2c3e50'],
  shirt: ['collared'],
  shirtColor: [clothingColorPalette[5]],
  ears: ['detached'],
};

const persona3: Persona = {
  id: 'bot-3-alex',
  style: 'avataaars',
  gender: 'male',
  // No colors specified, will be random based on the stable ID 'bot-3-alex'
};

const persona4: Persona = {
  id: `bot-4-random-${Date.now()}`, // Using Date.now() creates a new ID on every run for true randomness
  style: 'avataaars',
  gender: 'female',
};

// --- Generation ---

const svgs = {
  'samantha-happy': renderPersonaAvatar(persona1, 'happy'),
  'samantha-surprised': renderPersonaAvatar(persona1, 'surprised'),
  'marcus-calm': renderPersonaAvatar(persona2, 'calm'),
  'marcus-skeptical': renderPersonaAvatar(persona2, 'skeptical'),
  'alex-neutral': renderPersonaAvatar(persona3, 'attentive'),
  'random-female-happy': renderPersonaAvatar(persona4, 'happy'),
};

for (const [name, svg] of Object.entries(svgs)) {
  const path = `${outDir}/${name}.svg`;
  writeFileSync(path, svg);
  console.log(`✅ Wrote ${path}`);
}

console.log('\nAvatar generation test complete!');
