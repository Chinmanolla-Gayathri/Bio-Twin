"use client";

import { type SimulationState, type OrganId, type Severity, type DiseaseTendency, type TreatmentResponse } from "@/lib/twin-types";
import { severityFromHealth } from "@/lib/twin-types";
import { Brain, Heart, Wind, Droplets, Activity, CircleDot, Flame, Lightbulb, TrendingUp, AlertTriangle, Shield, Syringe, ArrowUpRight } from "lucide-react";

interface Props {
  state: SimulationState;
  selected: OrganId | null;
  onSelect: (id: OrganId | null) => void;
}

const ICONS: Record<OrganId, typeof Brain> = {
  brain: Brain,
  heart: Heart,
  lungs: Wind,
  liver: Droplets,
  kidneys: Activity,
  stomach: Flame,
  reproductive: CircleDot,
};

const SEV_LABEL: Record<Severity, string> = {
  good: "Healthy",
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
};

function sevCls(s: Severity): string {
  switch (s) {
    case "good": return "text-severity-good bg-severity-good/10 border-severity-good/40";
    case "mild": return "text-severity-mild bg-severity-mild/10 border-severity-mild/40";
    case "moderate": return "text-severity-moderate bg-severity-moderate/10 border-severity-moderate/40";
    case "severe": return "text-severity-severe bg-severity-severe/15 border-severity-severe/50";
  }
}

function scoreColor(score: number): string {
  if (score >= 75) return "var(--sev-good)";
  if (score >= 50) return "var(--sev-mild)";
  if (score >= 25) return "var(--sev-moderate)";
  return "var(--sev-severe)";
}

function tendencyColor(t: number): string {
  if (t >= 0.6) return "var(--sev-severe)";
  if (t >= 0.35) return "var(--sev-moderate)";
  if (t >= 0.15) return "var(--sev-mild)";
  return "var(--sev-good)";
}

function tendencyLabel(t: number): string {
  if (t >= 0.6) return "High Risk";
  if (t >= 0.35) return "Moderate";
  if (t >= 0.15) return "Low";
  return "Minimal";
}

function categoryBadge(cat: DiseaseTendency["category"]): { label: string; cls: string } {
  switch (cat) {
    case "lifestyle": return { label: "Lifestyle", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
    case "genetic": return { label: "Genetic", cls: "bg-purple-500/10 text-purple-400 border-purple-500/30" };
    case "age-related": return { label: "Age", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
    case "gender-specific": return { label: "Gender", cls: "bg-pink-500/10 text-pink-400 border-pink-500/30" };
    case "custom": return { label: "Custom", cls: "bg-teal-500/10 text-teal-400 border-teal-500/30" };
  }
}

export default function OrganDetailsPanel({ state, selected, onSelect }: Props) {
  const organ = selected ? state.organs[selected] : null;
  const tendencies = state.diseaseTendencies || [];
  const treatmentEffects = state.treatmentEffects;

  return (
    <aside className="panel flex h-full flex-col overflow-hidden">
      <header className="border-b border-border/60 p-4">
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Organ Diagnostics
        </h2>
        <p className="mt-1 text-xs text-muted-foreground/80">
          {organ ? "Live readings" : "Select an organ in Internal mode"}
        </p>
      </header>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {/* Treatment effects summary */}
        {treatmentEffects && treatmentEffects.totalImprovement > 0 && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Syringe className="h-3.5 w-3.5 text-green-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-green-400">
                Treatment Response
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(treatmentEffects.organImprovements)
                .filter(([, v]) => v > 0)
                .slice(0, 4)
                .map(([id, improvement]) => (
                  <div key={id} className="flex items-center gap-1.5 rounded-md bg-green-500/10 px-2 py-1">
                    <ArrowUpRight className="h-3 w-3 text-green-400" />
                    <span className="text-[10px] capitalize text-muted-foreground">{id}</span>
                    <span className="ml-auto text-[10px] font-mono text-green-400">+{improvement}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Organ grid */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(state.organs) as OrganId[]).map((id) => {
            const o = state.organs[id];
            const Icon = ICONS[id];
            const active = selected === id;
            const hasTreatment = o.treatmentResponse?.isReceivingTreatment;
            return (
              <button
                key={id}
                onClick={() => onSelect(active ? null : id)}
                className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-all ${
                  active
                    ? "border-primary bg-primary/10"
                    : hasTreatment
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-border/60 bg-secondary/30 hover:bg-secondary/60"
                }`}
              >
                <Icon className="h-4 w-4" style={{ color: scoreColor(o.healthScore) }} />
                <span className="text-[10px] capitalize text-muted-foreground">{o.name}</span>
                <span className="font-mono text-[9px] font-bold" style={{ color: scoreColor(o.healthScore) }}>
                  {o.healthScore}
                </span>
                <span
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                  style={{ background: scoreColor(o.healthScore), boxShadow: `0 0 8px ${scoreColor(o.healthScore)}` }}
                />
                {hasTreatment && (
                  <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Detail card */}
        {organ ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-4 animate-fade-in">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{organ.name}</h3>
                <p className="text-xs text-muted-foreground">Health Score</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-2xl font-bold" style={{ color: scoreColor(organ.healthScore) }}>
                  {organ.healthScore}
                </span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>

            {/* Score bar */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${organ.healthScore}%`,
                  background: `linear-gradient(90deg, var(--sev-severe), var(--sev-${organ.severity}))`,
                  boxShadow: `0 0 12px ${scoreColor(organ.healthScore)}`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${sevCls(organ.severity)}`}>
                {SEV_LABEL[organ.severity]}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Decay: {Math.round(organ.decay * 100)}%
              </span>
            </div>

            {/* Treatment Response */}
            {organ.treatmentResponse && organ.treatmentResponse.isReceivingTreatment && (
              <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Syringe className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-green-400">
                    Treatment Active
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Active treatments</span>
                    <span className="text-foreground">{organ.treatmentResponse.activeTreatments.join(", ")}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Health improvement</span>
                    <span className="text-green-400 font-mono">+{organ.treatmentResponse.healthImprovement}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Decay reversal rate</span>
                    <span className="text-green-400 font-mono">{(organ.treatmentResponse.reversalRate * 100).toFixed(1)}%/day</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Projected recovery</span>
                    <span className="text-primary font-mono">{organ.treatmentResponse.projectedRecovery}/100</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 text-xs">
              <div>
                <p className="text-muted-foreground">Primary cause</p>
                <p className="text-foreground leading-relaxed">{organ.cause}</p>
              </div>
              <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
                <p className="text-foreground/90">{organ.advice}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-secondary/10 p-6 text-center text-xs text-muted-foreground">
            Click any organ on the body or in the grid above
          </div>
        )}

        {/* Risks */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Risk Forecast
          </h4>
          {[
            { label: "Obesity", v: state.risks.obesity },
            { label: "Heart disease", v: state.risks.heart },
            { label: "Diabetes (T2)", v: state.risks.diabetes },
          ].map((r) => {
            const pct = Math.round(r.v * 100);
            const tone = r.v > 0.66 ? "severe" : r.v > 0.4 ? "moderate" : r.v > 0.2 ? "mild" : "good";
            return (
              <div key={r.label} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-mono text-foreground">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, background: `var(--sev-${tone})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Disease Tendency Predictions */}
        {tendencies.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-4">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Disease Tendency Prediction
              </h4>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mb-2">
              Based on your parameters, these diseases have a tendency to develop. Higher scores mean greater risk.
            </p>
            <div className="space-y-2">
              {tendencies.slice(0, 6).map((d) => {
                const pct = Math.round(d.tendency * 100);
                const cat = categoryBadge(d.category);
                return (
                  <div
                    key={d.name}
                    className="rounded-lg border border-border/50 bg-secondary/15 p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle
                          className="h-3 w-3 shrink-0"
                          style={{ color: tendencyColor(d.tendency) }}
                        />
                        <span className="text-[11px] font-medium text-foreground">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-medium ${cat.cls}`}>
                          {cat.label}
                        </span>
                        <span
                          className="font-mono text-[11px] font-bold"
                          style={{ color: tendencyColor(d.tendency) }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: tendencyColor(d.tendency),
                          boxShadow: `0 0 8px ${tendencyColor(d.tendency)}40`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                      {d.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI insight */}
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-accent">
            <Shield className="h-3.5 w-3.5" />
            AI INSIGHT
          </div>
          <p className="text-foreground/80 leading-relaxed">
            {generateInsight(state)}
          </p>
        </div>
      </div>
    </aside>
  );
}

function generateInsight(s: SimulationState): string {
  const worst = (Object.values(s.organs) as { name: string; healthScore: number }[])
    .sort((a, b) => a.healthScore - b.healthScore)[0];
  const bmi = s.body.bmi.toFixed(1);
  const topTendency = s.diseaseTendencies?.[0];

  // Check for treatment effects
  const treatmentEffects = s.treatmentEffects;
  const hasTreatments = treatmentEffects && treatmentEffects.totalImprovement > 0;

  let base = "";
  if (worst.healthScore >= 75) {
    base = `Excellent trajectory. BMI ${bmi}, all systems within healthy range (lowest: ${worst.name} at ${worst.healthScore}/100).`;
  } else if (worst.healthScore >= 50) {
    base = `BMI ${bmi}. Mild stress detected on ${worst.name.toLowerCase()} (${worst.healthScore}/100).`;
  } else if (worst.healthScore >= 25) {
    base = `BMI ${bmi}. Your ${worst.name.toLowerCase()} is at ${worst.healthScore}/100 — moderate decline.`;
  } else {
    base = `BMI ${bmi}. Critical: ${worst.name.toLowerCase()} at ${worst.healthScore}/100. Seek medical attention.`;
  }

  if (hasTreatments) {
    const improvingOrgans = Object.entries(treatmentEffects!.organImprovements)
      .filter(([, v]) => v > 0)
      .map(([k]) => k);
    if (improvingOrgans.length > 0) {
      base += ` Active treatments are improving ${improvingOrgans.join(", ")} — continue adherence for best results.`;
    }
  }

  if (topTendency && topTendency.tendency > 0.3) {
    base += ` Highest disease tendency: ${topTendency.name} at ${Math.round(topTendency.tendency * 100)}%. Consider lifestyle changes to reduce this risk.`;
  }

  return base;
}
