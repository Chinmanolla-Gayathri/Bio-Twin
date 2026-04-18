"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { type TwinInputs } from "@/lib/twin-types";
import { Sparkles, Play, Mars, Venus, Plus, X, Droplets } from "lucide-react";

interface Props {
  inputs: TwinInputs;
  onChange: (next: TwinInputs) => void;
  onCreate: () => void;
  onSimulate: () => void;
  twinCreated: boolean;
}

// Period issue options for females
const PERIOD_ISSUES = ["Cramps", "Heavy Bleeding", "Irregular Timing", "Missed Periods", "Mood Swings", "Bloating", "Acne Flare-ups"];

// Gender-specific conditions - includes Migraine from uploaded app
const MALE_CONDITIONS = ["Hypertension", "Diabetes", "Asthma", "Anxiety", "Migraine"];
const FEMALE_CONDITIONS = ["Hypertension", "Diabetes", "Asthma", "Anxiety", "PCOS", "Migraine"];

function SliderRow({
  label, value, min, max, step, onChange: oc, suffix,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="font-mono text-foreground">{value}{suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step ?? 1} onValueChange={(v) => oc(v[0])} />
    </div>
  );
}

export default function InputPanel({ inputs, onChange, onCreate, onSimulate, twinCreated }: Props) {
  const set = <K extends keyof TwinInputs>(k: K, v: TwinInputs[K]) =>
    onChange({ ...inputs, [k]: v });

  const conditions = inputs.gender === "female" ? FEMALE_CONDITIONS : MALE_CONDITIONS;

  const toggleCondition = (c: string) => {
    const next = inputs.conditions.includes(c)
      ? inputs.conditions.filter((x) => x !== c)
      : [...inputs.conditions, c];
    set("conditions", next);
  };

  const customConditions = inputs.customConditions || [];
  const addCustomCondition = (text: string) => {
    const trimmed = text.trim();
    if (trimmed && !customConditions.includes(trimmed) && !conditions.includes(trimmed)) {
      set("customConditions", [...customConditions, trimmed]);
    }
  };
  const removeCustomCondition = (c: string) => {
    set("customConditions", customConditions.filter((x) => x !== c));
  };

  const handleNotesChange = (text: string) => {
    set("notes", text);
  };

  const [customInput, setCustomInput] = useState("");
  const handleAddCondition = () => {
    if (customInput.trim()) {
      addCustomCondition(customInput.trim());
      setCustomInput("");
    }
  };

  return (
    <aside className="panel flex h-full flex-col overflow-hidden">
      <header className="border-b border-border/60 p-4">
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Lifestyle Profile
        </h2>
        <p className="mt-1 text-xs text-muted-foreground/80">Configure your digital twin</p>
      </header>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-4">
        {/* Gender */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Gender</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["male", "female"] as const).map((g) => {
              const Icon = g === "male" ? Mars : Venus;
              const active = inputs.gender === g;
              return (
                <button
                  key={g}
                  onClick={() => {
                    const genderConditions = g === "female" ? MALE_CONDITIONS : FEMALE_CONDITIONS;
                    const filtered = inputs.conditions.filter((c) => !genderConditions.includes(c) || conditions.includes(c));
                    const final = g === "male" ? filtered.filter((c) => c !== "PCOS") : filtered;
                    // Clear period data when switching to male
                    const periodReset = g === "male" ? { periodCycle: "" as const, periodIssues: [] } : {};
                    onChange({ ...inputs, gender: g, conditions: final, ...periodReset });
                  }}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_oklch(0.78_0.15_195/0.25)]"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="capitalize">{g}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Age / Height / Weight */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { k: "age" as const, label: "Age", min: 1, max: 100 },
            { k: "height" as const, label: "Height", min: 100, max: 220 },
            { k: "weight" as const, label: "Weight", min: 30, max: 200 },
          ].map((f) => (
            <div key={f.k} className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</Label>
              <Input
                type="number"
                value={inputs[f.k]}
                min={f.min}
                max={f.max}
                onChange={(e) => set(f.k, Number(e.target.value))}
                className="h-9 bg-secondary/40 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="space-y-4 border-t border-border/60 pt-4">
          <SliderRow label="Calories / day" value={inputs.calories} min={1000} max={5000} step={50} suffix=" kcal" onChange={(v) => set("calories", v)} />
          <SliderRow label="Water" value={inputs.water} min={0} max={6} step={0.1} suffix=" L" onChange={(v) => set("water", v)} />
          <SliderRow label="Sleep" value={inputs.sleep} min={0} max={12} step={0.5} suffix=" h" onChange={(v) => set("sleep", v)} />
          <SliderRow label="Exercise level" value={inputs.exercise} min={0} max={5} onChange={(v) => set("exercise", v)} />
          <SliderRow label="Smoking" value={inputs.smoking} min={0} max={40} suffix=" /day" onChange={(v) => set("smoking", v)} />
          <SliderRow label="Alcohol" value={inputs.alcohol} min={0} max={30} suffix=" /wk" onChange={(v) => set("alcohol", v)} />
          <SliderRow label="Stress" value={inputs.stress} min={0} max={10} onChange={(v) => set("stress", v)} />
          <SliderRow label="Junk Food" value={inputs.junkFood ?? 2} min={0} max={7} suffix=" days/wk" onChange={(v) => set("junkFood", v)} />
        </div>

        {/* Period Cycle - Female Only */}
        {inputs.gender === "female" && (
          <div className="space-y-3 border-t border-pink-500/30 pt-4">
            <Label className="flex items-center gap-1.5 text-xs text-pink-400">
              <Droplets className="h-3 w-3" />
              Period Cycle
            </Label>

            {/* Cycle regularity selector */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Regularity</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["regular", "irregular", "missed"] as const).map((opt) => {
                  const active = inputs.periodCycle === opt;
                  const optLabel = opt === "regular" ? "Regular" : opt === "irregular" ? "Irregular" : "Missed";
                  const optColor = opt === "regular"
                    ? active ? "border-green-500/60 bg-green-500/15 text-green-400" : "border-border bg-secondary/40 text-muted-foreground"
                    : opt === "irregular"
                    ? active ? "border-amber-500/60 bg-amber-500/15 text-amber-400" : "border-border bg-secondary/40 text-muted-foreground"
                    : active ? "border-red-500/60 bg-red-500/15 text-red-400" : "border-border bg-secondary/40 text-muted-foreground";
                  return (
                    <button
                      key={opt}
                      onClick={() => set("periodCycle", inputs.periodCycle === opt ? "" : opt)}
                      className={`rounded-md border px-2 py-1.5 text-[11px] transition-all ${optColor}`}
                    >
                      {optLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Period issues */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Issues</Label>
              <div className="flex flex-wrap gap-1">
                {PERIOD_ISSUES.map((issue) => {
                  const active = (inputs.periodIssues ?? []).includes(issue);
                  return (
                    <Badge
                      key={issue}
                      onClick={() => {
                        const current = inputs.periodIssues ?? [];
                        const next = active
                          ? current.filter((x) => x !== issue)
                          : [...current, issue];
                        set("periodIssues", next);
                      }}
                      className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[10px] transition-all ${
                        active
                          ? "bg-pink-500/80 text-white"
                          : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {issue}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Preset Health Conditions */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <Label className="text-xs text-muted-foreground">
            Health Conditions
            {inputs.gender === "female" && (
              <span className="ml-1 text-[10px] text-primary/70">(incl. female-specific)</span>
            )}
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((c) => {
              const active = inputs.conditions.includes(c);
              const isGenderSpecific = c === "PCOS";
              return (
                <Badge
                  key={c}
                  onClick={() => toggleCondition(c)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-[11px] transition-all ${
                    active
                      ? isGenderSpecific
                        ? "bg-pink-500/80 text-white"
                        : "bg-primary text-primary-foreground"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {c}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Custom Conditions */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <Label className="text-xs text-muted-foreground">
            Custom Conditions
            <span className="ml-1 text-[10px] text-muted-foreground/60">Add your own</span>
          </Label>
          <div className="flex gap-1.5">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCondition(); }}
              placeholder="e.g. Migraine, Arthritis..."
              className="h-8 flex-1 bg-secondary/40 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCondition}
              className="h-8 w-8 shrink-0 border-primary/40 p-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {customConditions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customConditions.map((c) => (
                <Badge
                  key={c}
                  variant="outline"
                  className="gap-1 rounded-full border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-400"
                >
                  {c}
                  <button
                    onClick={() => removeCustomCondition(c)}
                    className="ml-0.5 hover:text-amber-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Additional Notes */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <Label className="text-xs text-muted-foreground">
            Additional Details
            <span className="ml-1 text-[10px] text-muted-foreground/60">Symptoms, family history, etc.</span>
          </Label>
          <Textarea
            value={inputs.notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="e.g. Family history of heart disease, occasional migraines, joint pain in knees..."
            className="min-h-[80px] resize-none bg-secondary/40 text-xs leading-relaxed"
          />
          <p className="text-[10px] text-muted-foreground/60">
            Mention any symptoms, family history, or concerns. These will be factored into disease tendency predictions.
          </p>
        </div>
      </div>

      <footer className="space-y-2 border-t border-border/60 p-4">
        <Button
          onClick={onCreate}
          variant="outline"
          className="w-full border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {twinCreated ? "Recreate Digital Twin" : "Create Digital Twin"}
        </Button>
        <Button
          onClick={onSimulate}
          disabled={!twinCreated}
          className="w-full"
          style={{ background: "var(--gradient-cyber)", color: "var(--primary-foreground)" }}
        >
          <Play className="mr-2 h-4 w-4" />
          Simulate 60 Days
        </Button>
      </footer>
    </aside>
  );
}
