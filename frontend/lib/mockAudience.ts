import { faker } from "@faker-js/faker";

export type Bot = {
  id: string;
  name: string;
  avatar: string; // emoji for now
};

const emojiPalette = [
  "😀",
  "🙂",
  "😎",
  "🤔",
  "👏",
  "🤖",
  "🧠",
  "🧐",
  "🤓",
  "🧑‍💻",
];

export function generateBot(): Bot {
  return {
    id: faker.string.uuid(),
    name: faker.person.firstName(),
    avatar: faker.helpers.arrayElement(emojiPalette),
  };
}

export function seedBots(min: number, max: number): Bot[] {
  const count = faker.number.int({ min, max });
  return Array.from({ length: count }, () => generateBot());
}

export type Reaction = {
  emoji: string;
  phrase: string; // ≤ 3 words
  intensity: number; // -2..+2
};

const reactionEmojis = ["👍", "👏", "🧐", "🤔", "🔥", "✅", "❓", "💡", "😬"];
const phrases = [
  "nice point",
  "needs detail",
  "love it",
  "why now?",
  "too vague",
  "sounds risky",
  "great pace",
  "clear ask",
  "bold claim",
];

export function generateReaction(): Reaction {
  const sign = faker.number.int({ min: -2, max: 2 });
  return {
    emoji: faker.helpers.arrayElement(reactionEmojis),
    phrase: faker.helpers.arrayElement(phrases),
    intensity: sign,
  };
}
