"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  type Treatment,
  type ActiveTreatment,
  type TreatmentCategory,
  AVAILABLE_TREATMENTS,
} from "@/lib/twin-types";
import {
  Pill,
  HeartPulse,
  Droplets,
  Moon,
  Apple,
  Brain,
  Wind,
  Activity,
  Fish,
  Sun,
  FlaskConical,
  Leaf,
  CigaretteOff,
  WineOff,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Syringe,
  Salad,
  Dumbbell,
} from "lucide-react";

interface Props {
  activeTreatments: ActiveTreatment[];
  onAddTreatment: (treatment: Treatment) => void;
  onRemoveTreatment: (treatmentId: string) => void;
  onUpdateAdherence: (treatmentId: string, adherence: number) => void;
  currentDay: number;
}

const ICON_MAP: Record<string, typeof Pill> = {
  Pill,
  HeartPulse,
  CigaretteOff,
  WineOff,
  Droplets,
  Moon,
  Apple,
  Brain,
  Wind,
  Activity,
  Fish,
  Sun,
  FlaskConical,
  Leaf,
  Syringe,
  Salad,
  Dumbbell,
};

const CATEGORY_COLORS: Record<TreatmentCategory, string> = {
  medication: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  lifestyle: "bg-green-500/10 text-green-400 border-green-500/30",
  therapy: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  supplement: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const CATEGORY_LABELS: Record<TreatmentCategory, string> = {
  medication: "Medication",
  lifestyle: "Lifestyle",
  therapy: "Therapy",
  supplement: "Supplement",
};

const CATEGORY_DESCRIPTIONS: Record<TreatmentCategory, string> = {
  medication: "Prescription drugs targeting specific organs to slow disease progression and manage symptoms. Requires medical supervision.",
  lifestyle: "Behavioral changes including diet, exercise, and habit modification. High long-term impact with minimal side effects.",
  therapy: "Structured therapeutic interventions for mental and physical rehabilitation. Builds resilience and coping mechanisms.",
  supplement: "Vitamins, minerals, and herbal extracts supporting organ function. Works best alongside other treatments.",
};

export default function TreatmentPanel({
  activeTreatments,
  onAddTreatment,
  onRemoveTreatment,
  onUpdateAdherence,
  currentDay,
}: Props) {
  const [expandedCategory, setExpandedCategory] = useState<TreatmentCategory | null>("lifestyle");
  const [showAll, setShowAll] = useState(false);

  const activeIds = new Set(activeTreatments.map((at) => at.treatment.id));

  const categories: TreatmentCategory[] = ["lifestyle", "medication", "therapy", "supplement"];

  const filteredTreatments = AVAILABLE_TREATMENTS.filter((t) => {
    if (activeIds.has(t.id)) return false;
    return true;
  });

  return (
    <aside className="panel flex h-full flex-col overflow-hidden">
      <header className="border-b border-border/60 p-4">
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Treatment Simulator
        </h2>
        <p className="mt-1 text-xs text-muted-foreground/80">
          Apply treatments and see organ response
        </p>
      </header>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {/* Active Treatments */}
        {activeTreatments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
              Active Treatments ({activeTreatments.length})
            </h3>
            {activeTreatments.map((at) => {
              const daysOn = Math.max(0, currentDay - at.startDay);
              const rampUp = Math.min(1, daysOn / at.treatment.duration);
              const effectiveness = Math.round(at.treatment.effectiveness * at.adherence * rampUp * 100);
              const IconComp = ICON_MAP[at.treatment.icon] || Pill;

              return (
                <div
                  key={at.treatment.id}
                  className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 animate-fade-in"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15">
                        <IconComp className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{at.treatment.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {daysOn > 0 ? `Day ${daysOn} of treatment` : "Starting..."}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveTreatment(at.treatment.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Effectiveness bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Effectiveness</span>
                      <span className="text-primary font-mono">{effectiveness}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all bg-primary"
                        style={{
                          width: `${effectiveness}%`,
                          boxShadow: "0 0 8px oklch(0.78 0.15 195 / 0.4)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Adherence slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Adherence</span>
                      <span className="font-mono text-foreground">{Math.round(at.adherence * 100)}%</span>
                    </div>
                    <Slider
                      value={[at.adherence * 100]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={(v) => onUpdateAdherence(at.treatment.id, v[0] / 100)}
                    />
                  </div>

                  {/* Target organs */}
                  <div className="flex flex-wrap gap-1">
                    {at.treatment.targetOrgans.map((oid) => (
                      <span
                        key={oid}
                        className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] capitalize text-primary"
                      >
                        {oid}
                      </span>
                    ))}
                  </div>

                  {/* Side effects */}
                  {at.treatment.sideEffects && (
                    <p className="text-[9px] text-amber-400/80 leading-relaxed">
                      ⚠ {at.treatment.sideEffects}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Available Treatments by Category */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Available Treatments
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-muted-foreground"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show Less" : "Show All"}
            </Button>
          </div>

          {categories.map((cat) => {
            const catTreatments = filteredTreatments.filter((t) => t.category === cat);
            if (catTreatments.length === 0) return null;

            const isExpanded = expandedCategory === cat;
            const displayed = isExpanded || showAll ? catTreatments : catTreatments.slice(0, 2);

            return (
              <div key={cat} className="space-y-1.5">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${CATEGORY_COLORS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{catTreatments.length} available</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
                {(isExpanded || showAll) && (
                  <p className="px-2 pb-1 text-[9px] text-muted-foreground/60 leading-relaxed">
                    {CATEGORY_DESCRIPTIONS[cat]}
                  </p>
                )}

                {(isExpanded || showAll) && catTreatments.map((treatment) => {
                  const IconComp = ICON_MAP[treatment.icon] || Pill;
                  const isActive = activeIds.has(treatment.id);

                  return (
                    <div
                      key={treatment.id}
                      className="group rounded-lg border border-border/40 bg-secondary/15 p-2.5 transition-all hover:border-primary/30 hover:bg-secondary/25"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary/60">
                            <IconComp className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-foreground">{treatment.name}</p>
                            <p className="mt-0.5 text-[9px] text-muted-foreground/80 line-clamp-2 leading-relaxed">
                              {treatment.description}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 h-6 w-6 shrink-0 border-primary/30 bg-primary/5 p-0 hover:bg-primary/15"
                          onClick={() => onAddTreatment(treatment)}
                          disabled={isActive}
                        >
                          <Plus className="h-3 w-3 text-primary" />
                        </Button>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex flex-wrap gap-1">
                          {treatment.targetOrgans.map((oid) => (
                            <span
                              key={oid}
                              className="rounded-full border border-border/40 bg-secondary/30 px-1.5 py-0.5 text-[8px] capitalize text-muted-foreground"
                            >
                              {oid}
                            </span>
                          ))}
                        </div>
                        <span className="ml-auto text-[9px] font-mono text-muted-foreground">
                          Eff: {Math.round(treatment.effectiveness * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}

                {!isExpanded && !showAll && catTreatments.length > 2 && (
                  <button
                    onClick={() => setExpandedCategory(cat)}
                    className="w-full rounded-md py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    +{catTreatments.length - 2} more {CATEGORY_LABELS[cat].toLowerCase()} treatments
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {activeTreatments.length > 0 && (
        <footer className="border-t border-border/60 p-3">
          <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-center">
            <p className="text-[10px] text-primary">
              {activeTreatments.length} treatment{activeTreatments.length !== 1 ? "s" : ""} active
              — simulation will reflect organ improvements
            </p>
          </div>
        </footer>
      )}
    </aside>
  );
}
