"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Spotlight } from "@/components/ui/spotlight-new";
import WalkingAudience from "@/components/walkers";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { deriveSeedFromConfig, getMockCategories } from "../../lib/mockScene";

export default function QuestionnairePage() {
  const router = useRouter();
  const categories = useMemo(() => getMockCategories(10, 123), []);
  const [showForm, setShowForm] = useState<boolean>(false);

  const form = useForm<{ category: string; lengthSec: number }>({
    defaultValues: {
      category: categories[0] ?? "General",
      lengthSec: 120,
    },
  });

  function onSubmit(values: { category: string; lengthSec: number }) {
    const seed = deriveSeedFromConfig(values.category, values.lengthSec);
    const params = new URLSearchParams({
      seed: String(seed),
      category: values.category,
      length: String(values.lengthSec),
    });
    router.push(`/scene?${params.toString()}`);
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="min-h-dvh w-full rounded-md flex items-center justify-center bg-black/[0.96] pb-16 antialiased bg-grid-white/[0.02] relative overflow-hidden">
        <Spotlight />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: showForm ? 0 : 1, y: showForm ? -8 : 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="p-4 max-w-7xl mx-auto relative z-10 w-full"
        >
          <h1 className="text-4xl md:text-7xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50">
            Pitch your idea.
            <br /> Make it unforgettable.
          </h1>
          <p className="mt-4 font-normal text-base text-neutral-300 max-w-lg text-center mx-auto">
            Seed your audience, pick a length, and start your scene.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex h-10 items-center justify-center rounded-md border bg-primary text-primary-foreground px-6 text-sm font-medium hover:opacity-90"
            >
              Start
            </button>
          </div>
        </motion.div>
      </div>
      <WalkingAudience />

      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="rounded-lg border bg-card text-card-foreground p-5 shadow-sm"
                  >
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold tracking-tight">
                        Pitch setup
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choose a category and length to seed your audience.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <FormControl>
                              <select
                                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                                value={field.value}
                                onChange={field.onChange}
                              >
                                {categories.map((c: string) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lengthSec"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pitch length (seconds)</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-3">
                                <Slider
                                  min={60}
                                  max={300}
                                  step={30}
                                  value={[field.value]}
                                  onValueChange={(vals) =>
                                    field.onChange(vals[0])
                                  }
                                />
                                <span className="w-12 text-right text-sm tabular-nums">
                                  {field.value}
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-5 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:opacity-90"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center justify-center rounded-md border bg-primary text-primary-foreground px-4 text-sm font-medium hover:opacity-90"
                      >
                        Start scene
                      </button>
                    </div>
                  </form>
                </Form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
