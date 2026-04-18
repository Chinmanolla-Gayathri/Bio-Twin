"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import InputPanel from "@/components/twin/InputPanel";
import OrganDetailsPanel from "@/components/twin/OrganDetailsPanel";
import TimelineSlider from "@/components/twin/TimelineSlider";
import MetricsCharts from "@/components/twin/MetricsCharts";
import TreatmentPanel from "@/components/twin/TreatmentPanel";
import AIRecommendationsPanel from "@/components/twin/AIRecommendationsPanel";
import AIChatBox from "@/components/twin/AIChatBox";
import { DEFAULT_INPUTS, type OrganId, type TwinInputs, type ActiveTreatment, type Treatment, type AIRecommendation } from "@/lib/twin-types";
import { simulate, generateLocalRecommendations } from "@/lib/twin-engine";
import { Eye, EyeOff, Activity, Heart, Syringe, Sparkles, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

// Dynamic import for R3F (no SSR)
const HumanBodyCanvas = dynamic(
  () => import("@/components/twin/HumanBodyCanvas"),
  { ssr: false }
);

export default function Index() {
  const [inputs, setInputs] = useState<TwinInputs>(DEFAULT_INPUTS);
  const [committedInputs, setCommittedInputs] = useState<TwinInputs>(DEFAULT_INPUTS);
  const [twinCreated, setTwinCreated] = useState(true);
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"external" | "internal">("external");
  const [selectedOrgan, setSelectedOrgan] = useState<OrganId | null>(null);

  // Treatment state
  const [activeTreatments, setActiveTreatments] = useState<ActiveTreatment[]>([]);
  const [showTreatmentPanel, setShowTreatmentPanel] = useState(false);

  // AI Recommendations state
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);

  // UI state
  const [inputCollapsed, setInputCollapsed] = useState(false);

  const state = useMemo(() => simulate(committedInputs, day, activeTreatments), [committedInputs, day, activeTreatments]);

  // Overall health = average of all organ health scores
  const overallHealth = useMemo(() => {
    const scores = Object.values(state.organs).map((o) => o.healthScore);
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [state]);

  const handleCreate = () => {
    setCommittedInputs(inputs);
    setDay(0);
    setPlaying(false);
    setTwinCreated(true);
  };
  const handleSimulate = () => {
    setCommittedInputs(inputs);
    setDay(0);
    setPlaying(true);
  };

  // Treatment handlers
  const handleAddTreatment = useCallback((treatment: Treatment) => {
    setActiveTreatments((prev) => [
      ...prev,
      { treatment, startDay: day, adherence: 0.85 },
    ]);
  }, [day]);

  const handleRemoveTreatment = useCallback((treatmentId: string) => {
    setActiveTreatments((prev) => prev.filter((at) => at.treatment.id !== treatmentId));
  }, []);

  const handleUpdateAdherence = useCallback((treatmentId: string, adherence: number) => {
    setActiveTreatments((prev) =>
      prev.map((at) =>
        at.treatment.id === treatmentId ? { ...at, adherence } : at
      )
    );
  }, []);

  // AI Recommendations handler
  const handleGenerateAIRecommendations = useCallback(async () => {
    setAiLoading(true);
    setShowAIRecommendations(true);

    try {
      const response = await fetch("/api/ai-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulationState: state,
          inputs: committedInputs,
          day,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.recommendations && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
          setAiRecommendations(data.recommendations.map((r: AIRecommendation, i: number) => ({
            ...r,
            id: r.id || `ai-${i}`,
          })));
        } else {
          setAiRecommendations(generateLocalRecommendations(state));
        }
      } else {
        setAiRecommendations(generateLocalRecommendations(state));
      }
    } catch {
      setAiRecommendations(generateLocalRecommendations(state));
    } finally {
      setAiLoading(false);
    }
  }, [state, committedInputs, day]);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const healthColor = overallHealth >= 75 ? "var(--sev-good)" : overallHealth >= 50 ? "var(--sev-mild)" : overallHealth >= 25 ? "var(--sev-moderate)" : "var(--sev-severe)";
  const hasSimulation = day >= 60 || (!playing && day > 0);
  const hasTreatments = activeTreatments.length > 0;
  const showRightPanel = showTreatmentPanel || showAIRecommendations;

  return (
    <div className="grid-bg relative h-screen w-full overflow-hidden flex flex-col">
      {/* ===== Top bar with flow gradient border ===== */}
      <header className="flow-header relative z-10 flex items-center justify-between border-b border-border/40 bg-background/60 px-5 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--gradient-cyber)" }}>
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">
              <span className="text-gradient">BioTwin</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">Digital Twin Simulator</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Overall health badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-3 py-1">
            <Heart className="h-3 w-3" style={{ color: healthColor, fill: healthColor }} />
            <span className="font-mono text-xs font-bold" style={{ color: healthColor }}>
              {overallHealth}
            </span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>

          <div className="h-5 w-px bg-border/40" />

          {/* Treatment toggle */}
          <button
            onClick={() => {
              setShowTreatmentPanel(!showTreatmentPanel);
              if (showAIRecommendations) setShowAIRecommendations(false);
            }}
            className={`flow-btn flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
              showTreatmentPanel
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : hasTreatments
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Syringe className="h-3 w-3" />
            <span>Treatments</span>
            {hasTreatments && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                {activeTreatments.length}
              </span>
            )}
          </button>

          {/* AI Recommendations toggle */}
          <button
            onClick={() => {
              setShowAIRecommendations(!showAIRecommendations);
              if (showTreatmentPanel) setShowTreatmentPanel(false);
            }}
            className={`flow-btn flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
              showAIRecommendations
                ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_oklch(0.78_0.15_195/0.4)]"
                : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>AI Report</span>
          </button>

          <div className="h-5 w-px bg-border/40" />

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/40 p-0.5">
            {(["external", "internal"] as const).map((m) => {
              const Icon = m === "external" ? Eye : EyeOff;
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_0_18px_oklch(0.78_0.15_195/0.4)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="capitalize">{m}</span>
                </button>
              );
            })}
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="flow-btn flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </header>

      {/* ===== Main flow layout ===== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Input panel (collapsible) */}
        <div className={`flow-panel-left relative flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${inputCollapsed ? "w-0" : "w-[300px]"}`}>
          {!inputCollapsed && (
            <div className="h-full overflow-hidden opacity-100 transition-opacity duration-300">
              <InputPanel
                inputs={inputs}
                onChange={setInputs}
                onCreate={handleCreate}
                onSimulate={handleSimulate}
                twinCreated={twinCreated}
              />
            </div>
          )}
          {/* Collapse toggle */}
          <button
            onClick={() => setInputCollapsed(!inputCollapsed)}
            className="flow-collapse-btn absolute -right-3 top-1/2 -translate-y-1/2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/80 backdrop-blur-md text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            {inputCollapsed ? <PanelLeftOpen className="h-3 w-3" /> : <PanelLeftClose className="h-3 w-3" />}
          </button>
        </div>

        {/* Center: 3D Canvas + Bottom bar */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 p-2">
          {/* 3D Canvas */}
          <div className="panel panel-glow relative flex-1 min-h-0 overflow-hidden">
            {twinCreated ? (
              <HumanBodyCanvas
                state={state}
                gender={committedInputs.gender}
                mode={mode}
                selectedOrgan={selectedOrgan}
                onSelectOrgan={setSelectedOrgan}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Click &quot;Create Digital Twin&quot; to begin
              </div>
            )}
            {/* HUD corners */}
            <div className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] text-primary/70">
              BMI {state.body.bmi.toFixed(1)}
            </div>
            <div className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] text-primary/70">
              FATIGUE {(state.body.fatigue * 100).toFixed(0)}%
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] text-primary/70 uppercase">
              {mode} VIEW
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px]" style={{ color: healthColor }}>
              HEALTH {overallHealth}/100
            </div>
            {hasTreatments && (
              <div className="pointer-events-none absolute left-3 bottom-8 font-mono text-[10px] text-green-400/70">
                {activeTreatments.length} TX ACTIVE
              </div>
            )}
            {state.body.darkCircles > 0.15 && (
              <div className="pointer-events-none absolute right-3 bottom-8 font-mono text-[10px] text-purple-400/70">
                DARK CIRCLES {(state.body.darkCircles * 100).toFixed(0)}%
              </div>
            )}
          </div>

          {/* Bottom flow: metrics + timeline */}
          <div className="flex gap-2 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <MetricsCharts inputs={committedInputs} currentDay={day} activeTreatments={activeTreatments} />
            </div>
            <div className="w-[320px] flex-shrink-0">
              <TimelineSlider day={day} setDay={setDay} playing={playing} setPlaying={setPlaying} />
            </div>
          </div>
        </div>

        {/* Right: Organ details */}
        <div className="w-[300px] flex-shrink-0 overflow-hidden p-2 pl-0">
          <OrganDetailsPanel state={state} selected={selectedOrgan} onSelect={setSelectedOrgan} />
        </div>

        {/* Far right: Treatment or AI panel (conditional) */}
        <div className={`flex-shrink-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${showRightPanel ? "w-[280px] opacity-100 p-2 pl-0" : "w-0 opacity-0"}`}>
          {showRightPanel && (
            showTreatmentPanel ? (
              <TreatmentPanel
                activeTreatments={activeTreatments}
                onAddTreatment={handleAddTreatment}
                onRemoveTreatment={handleRemoveTreatment}
                onUpdateAdherence={handleUpdateAdherence}
                currentDay={day}
              />
            ) : (
              <aside className="panel flex h-full flex-col overflow-hidden">
                <header className="border-b border-border/60 p-4">
                  <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                    AI Health Report
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    AI-powered personalized recommendations
                  </p>
                </header>
                <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
                  <AIRecommendationsPanel
                    recommendations={aiRecommendations}
                    loading={aiLoading}
                    onGenerate={handleGenerateAIRecommendations}
                    hasSimulation={hasSimulation}
                  />
                </div>
              </aside>
            )
          )}
        </div>
      </div>

      {/* AI Chat Box */}
      <AIChatBox
        state={state}
        inputs={committedInputs}
        day={day}
        activeTreatments={activeTreatments}
        overallHealth={overallHealth}
      />
    </div>
  );
}
