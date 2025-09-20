"use client"; // This is a client component because it uses hooks (useState, useEffect)

import { useState, useEffect } from "react";
import { faker } from "@faker-js/faker";

// --- TYPE DEFINITIONS ---
// (Normally in /lib/types.ts)
type Stance = "supportive" | "skeptical" | "curious";
type Domain = "tech" | "design" | "finance";

interface Persona {
  stance: Stance;
  domain: Domain;
}

interface Bot {
  id: string;
  name: string;
  avatar: string; // emoji
  persona: Persona;
  reaction: string; // current emoji reaction
}

// --- FAKER UTILITY ---
const createRandomBot = (): Bot => {
  const stanceOptions: Stance[] = ["supportive", "skeptical", "curious"];
  const domainOptions: Domain[] = ["tech", "design", "finance"];

  return {
    id: faker.string.uuid(),
    name: faker.person.firstName(),
    avatar: faker.internet.emoji({ types: ['smiley', 'person'] }),
    persona: {
      stance: faker.helpers.arrayElement(stanceOptions),
      domain: faker.helpers.arrayElement(domainOptions),
    },
    reaction: "🤔", // Start with a thinking emoji
  };
};

// --- UI COMPONENTS ---

// BotAvatar Component (Normally in /components/BotAvatar.tsx)
const BotAvatar = ({ bot }: { bot: Bot }) => {
  return (
    <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-card text-card-foreground shadow-sm animate-in fade-in-50">
      <div className="relative w-24 h-24 flex items-center justify-center rounded-full bg-secondary">
        <span className="text-5xl">{bot.avatar}</span>
        <div className="absolute -bottom-2 -right-2 text-3xl bg-background rounded-full p-1">
          {bot.reaction}
        </div>
      </div>
      <div className="text-center">
        <p className="font-bold">{bot.name}</p>
        <p className="text-sm text-muted-foreground capitalize">{bot.persona.stance}</p>
      </div>
    </div>
  );
};

// AudienceGrid Component (Normally in /components/AudienceGrid.tsx)
const AudienceGrid = () => {
  const [bots, setBots] = useState<Bot[]>([]);

  // Initial bot spawning
  useEffect(() => {
    const botCount = faker.number.int({ min: 4, max: 12 });
    const initialBots = Array.from({ length: botCount }, createRandomBot);
    setBots(initialBots);
  }, []);

  // Simulate real-time reactions
  useEffect(() => {
    if (bots.length === 0) return;

    const interval = setInterval(() => {
      setBots((currentBots) => {
        const botToUpdateIndex = faker.number.int({ min: 0, max: currentBots.length - 1 });
        const newReaction = faker.internet.emoji({ types: ['smiley', 'cat', 'food', 'travel'] });

        return currentBots.map((bot, index) => {
          if (index === botToUpdateIndex) {
            return { ...bot, reaction: newReaction };
          }
          return bot;
        });
      });
    }, 2000); // Every 2 seconds, a random bot reacts

    return () => clearInterval(interval);
  }, [bots.length]);


  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-4">
      {bots.map((bot) => (
        <BotAvatar key={bot.id} bot={bot} />
      ))}
    </div>
  );
};


// --- MAIN PAGE ---
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <div className="w-full max-w-7xl">
        <h1 className="text-4xl font-bold text-center mb-2">Your Pitch Room</h1>
        <p className="text-lg text-muted-foreground text-center mb-8">
          The AI audience is listening...
        </p>
        <AudienceGrid />
      </div>
    </main>
  );
}
