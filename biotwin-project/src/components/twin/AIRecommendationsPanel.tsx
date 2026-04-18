"use client";

import { type AIRecommendation, type OrganId } from "@/lib/twin-types";
import {
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Heart,
  Brain,
  Wind,
  Droplets,
  Activity,
  Flame,
  CircleDot,
  Lightbulb,
  Loader2,
  Sparkles,
} from "lucide-react";

interface Props {
  recommendations: AIRecommendation[];
  loading: boolean;
  onGenerate: () => void;
  hasSimulation: boolean;
}

const ORGAN_ICONS: Record<OrganId, typeof Brain> = {
  brain: Brain,
  heart: Heart,
  lungs: Wind,
  liver: Droplets,
  kidneys: Activity,
  stomach: Flame,
  reproductive: CircleDot,
};

const CATEGORY_STYLES: Record<string, { border: string; bg: string; icon: typeof AlertTriangle; iconColor: string; label: string }> = {
  critical: {
    border: "border-red-500/40",
    bg: "bg-red-500/8",
    icon: AlertTriangle,
    iconColor: "text-red-400",
    label: "CRITICAL",
  },
  warning: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/8",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    label: "WARNING",
  },
  improvement: {
    border: "border-blue-500/40",
    bg: "bg-blue-500/8",
    icon: TrendingUp,
    iconColor: "text-blue-400",
    label: "IMPROVEMENT",
  },
  preventive: {
    border: "border-green-500/40",
    bg: "bg-green-500/8",
    icon: ShieldCheck,
    iconColor: "text-green-400",
    label: "PREVENTIVE",
  },
};

export default function AIRecommendationsPanel({ recommendations, loading, onGenerate, hasSimulation }: Props) {
  return (
    <div className="space-y-4">
      {/* Generate button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AI Recommendations
          </h3>
        </div>
        <button
          onClick={onGenerate}
          disabled={!hasSimulation || loading}
          className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[10px] font-medium text-primary transition-all hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              Generate AI Report
            </>
          )}
        </button>
      </div>

      {!hasSimulation && (
        <div className="rounded-lg border border-dashed border-border/60 bg-secondary/10 p-4 text-center text-xs text-muted-foreground">
          Complete a 60-day simulation first to generate AI recommendations
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-xs font-medium text-foreground">AI is analyzing your health data...</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Evaluating organ health, risk factors, and disease tendencies
            </p>
          </div>
        </div>
      )}

      {!loading && recommendations.length === 0 && hasSimulation && (
        <div className="rounded-lg border border-dashed border-border/60 bg-secondary/10 p-4 text-center text-xs text-muted-foreground">
          Click &quot;Generate AI Report&quot; to get personalized health recommendations powered by AI
        </div>
      )}

      {/* Recommendations list */}
      {!loading && recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((rec, i) => {
            const style = CATEGORY_STYLES[rec.category] || CATEGORY_STYLES.improvement;
            const CategoryIcon = style.icon;

            return (
              <div
                key={rec.id || i}
                className={`rounded-lg border ${style.border} ${style.bg} p-3 space-y-2.5 animate-fade-in`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <CategoryIcon className={`h-4 w-4 mt-0.5 shrink-0 ${style.iconColor}`} />
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">{rec.title}</p>
                      <span className={`inline-block mt-0.5 rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${style.border} ${style.iconColor}`}>
                        {style.label}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">P{rec.priority}</span>
                </div>

                {/* Description */}
                <p className="text-[10px] text-foreground/80 leading-relaxed pl-6">
                  {rec.description}
                </p>

                {/* Action Items */}
                <div className="pl-6 space-y-1">
                  {rec.actionItems.map((item, j) => (
                    <div key={j} className="flex items-start gap-1.5">
                      <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" />
                      <p className="text-[10px] text-foreground/70 leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>

                {/* Affected Organs */}
                {rec.affectedOrgans && rec.affectedOrgans.length > 0 && (
                  <div className="flex items-center gap-1.5 pl-6">
                    <span className="text-[9px] text-muted-foreground">Affects:</span>
                    {rec.affectedOrgans.map((oid: OrganId) => {
                      const OrganIcon = ORGAN_ICONS[oid];
                      return (
                        <span
                          key={oid}
                          className="flex items-center gap-1 rounded-full border border-border/40 bg-secondary/30 px-1.5 py-0.5 text-[8px] capitalize text-muted-foreground"
                        >
                          {OrganIcon && <OrganIcon className="h-2.5 w-2.5" />}
                          {oid}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
