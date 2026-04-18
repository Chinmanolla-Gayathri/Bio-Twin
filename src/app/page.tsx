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
import { Eye, EyeOff, Activity, Heart, Syringe, Sparkles, Maximize2, Minimize2, SlidersHorizontal, Brain, Pill, Sun, Moon } from "lucide-react";

// Dynamic import for R3F (no SSR)
const HumanBodyCanvas = dynamic(
  () => import("@/components/twin/HumanBodyCanvas"),
  { ssr: false }
);

type SidebarTab = "input" | "organs" | "treatments" | "ai-report";

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

  // AI Recommendations state
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<SidebarTab>("input");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelFullscreen, setPanelFullscreen] = useState(false);

  // Escape key exits panel fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panelFullscreen) {
        setPanelFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panelFullscreen]);

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

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Apply theme class to html element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

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

  // Tab definitions
  const tabs: { id: SidebarTab; label: string; icon: typeof SlidersHorizontal; badge?: number }[] = [
    { id: "input", label: "Input", icon: SlidersHorizontal },
    { id: "organs", label: "Organs", icon: Brain },
    { id: "treatments", label: "Treatments", icon: Pill, badge: hasTreatments ? activeTreatments.length : undefined },
    { id: "ai-report", label: "AI Report", icon: Sparkles },
  ];

  return (
    <div className="grid-bg relative h-screen w-full overflow-hidden flex flex-col">
      {/* ===== Clean Top bar ===== */}
      <header className="flow-header relative z-10 flex items-center justify-between border-b border-border/40 bg-background/60 px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--gradient-cyber)" }}>
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">
              <span className="text-gradient">BioTwin</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">Digital Twin</span>
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

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flow-btn flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          </button>

          {/* Browser fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="flow-btn flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </header>

      {/* ===== Main layout: Tabbed Sidebar + Canvas ===== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Tabbed Sidebar */}
        <div className={`relative flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarOpen ? "w-[340px]" : "w-0"}`}>
          {sidebarOpen && (
            <div className="flex h-full flex-col overflow-hidden border-r border-border/30 bg-background/40 backdrop-blur-sm">
              {/* Tab buttons */}
              <div className="flex border-b border-border/40 bg-secondary/20">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-all ${
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                          {tab.badge}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === "input" && (
                  <InputPanel
                    inputs={inputs}
                    onChange={setInputs}
                    onCreate={handleCreate}
                    onSimulate={handleSimulate}
                    twinCreated={twinCreated}
                  />
                )}
                {activeTab === "organs" && (
                  <OrganDetailsPanel state={state} selected={selectedOrgan} onSelect={setSelectedOrgan} />
                )}
                {activeTab === "treatments" && (
                  <TreatmentPanel
                    activeTreatments={activeTreatments}
                    onAddTreatment={handleAddTreatment}
                    onRemoveTreatment={handleRemoveTreatment}
                    onUpdateAdherence={handleUpdateAdherence}
                    currentDay={day}
                  />
                )}
                {activeTab === "ai-report" && (
                  <aside className="flex h-full flex-col overflow-hidden">
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
                )}
              </div>
            </div>
          )}
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/80 backdrop-blur-md text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            {sidebarOpen ? <span className="text-[10px]">◀</span> : <span className="text-[10px]">▶</span>}
          </button>
        </div>

        {/* Center: 3D Canvas + Bottom bar (conditionally rendered to avoid duplicate Canvas) */}
        {!panelFullscreen && (
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
              {state.body.darkCircles > 0.01 && (
                <div className="pointer-events-none absolute right-3 bottom-8 font-mono text-[10px] text-purple-400/70">
                  DARK CIRCLES {(state.body.darkCircles * 100).toFixed(0)}%
                </div>
              )}
              {/* Panel fullscreen toggle button - expand to overlay */}
              <button
                onClick={() => setPanelFullscreen(true)}
                className="absolute right-3 top-10 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
                aria-label="Expand canvas to panel fullscreen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
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
        )}
      </div>

      {/* Panel-level fullscreen overlay for 3D canvas */}
      {panelFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* 3D Canvas - full viewport */}
          <div className="relative flex-1 min-h-0 overflow-hidden">
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
            <div className="pointer-events-none absolute left-4 top-4 font-mono text-xs text-primary/70">
              BMI {state.body.bmi.toFixed(1)}
            </div>
            <div className="pointer-events-none absolute right-4 top-16 font-mono text-xs text-primary/70">
              FATIGUE {(state.body.fatigue * 100).toFixed(0)}%
            </div>
            <div className="pointer-events-none absolute bottom-4 left-4 font-mono text-xs text-primary/70 uppercase">
              {mode} VIEW
            </div>
            <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-xs" style={{ color: healthColor }}>
              HEALTH {overallHealth}/100
            </div>
            {hasTreatments && (
              <div className="pointer-events-none absolute left-4 bottom-10 font-mono text-xs text-green-400/70">
                {activeTreatments.length} TX ACTIVE
              </div>
            )}
            {state.body.darkCircles > 0.01 && (
              <div className="pointer-events-none absolute right-4 bottom-10 font-mono text-xs text-purple-400/70">
                DARK CIRCLES {(state.body.darkCircles * 100).toFixed(0)}%
              </div>
            )}

            {/* Fullscreen toolbar - top right */}
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
              {/* View mode toggle (External / Internal) */}
              <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/40 p-0.5 backdrop-blur-md">
                {(["external", "internal"] as const).map((m) => {
                  const Icon = m === "external" ? Eye : EyeOff;
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
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

              {/* Exit panel fullscreen button */}
              <button
                onClick={() => setPanelFullscreen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
                aria-label="Exit canvas panel fullscreen"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>

            {/* Organ description panel in fullscreen - left side */}
            <div className="pointer-events-auto absolute left-4 top-16 z-10 w-[280px] max-h-[calc(100%-5rem)] overflow-hidden rounded-xl border border-border/50 bg-background/80 backdrop-blur-xl shadow-lg">
              <div className="border-b border-border/40 px-4 py-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organ Health</h3>
              </div>
              <div className="scrollbar-thin max-h-[calc(100%-3rem)] overflow-y-auto p-3 space-y-2">
                {(Object.keys(state.organs) as OrganId[]).map((id) => {
                  const o = state.organs[id];
                  const isActive = selectedOrgan === id;
                  const scoreClr = o.healthScore >= 75 ? "var(--sev-good)" : o.healthScore >= 50 ? "var(--sev-mild)" : o.healthScore >= 25 ? "var(--sev-moderate)" : "var(--sev-severe)";
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedOrgan(isActive ? null : id)}
                      className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                        isActive
                          ? "border-primary bg-primary/10"
                          : "border-border/40 bg-secondary/20 hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-foreground capitalize">{o.name}</span>
                        <span className="font-mono text-xs font-bold" style={{ color: scoreClr }}>{o.healthScore}</span>
                      </div>
                      {/* Health bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${o.healthScore}%`,
                            background: scoreClr,
                            boxShadow: `0 0 8px ${scoreClr}40`,
                          }}
                        />
                      </div>
                      {/* Show details for selected organ */}
                      {isActive && (
                        <div className="mt-2 space-y-1.5 animate-fade-in">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${
                                o.severity === "good" ? "text-severity-good bg-severity-good/10 border-severity-good/40" :
                                o.severity === "mild" ? "text-severity-mild bg-severity-mild/10 border-severity-mild/40" :
                                o.severity === "moderate" ? "text-severity-moderate bg-severity-moderate/10 border-severity-moderate/40" :
                                "text-severity-severe bg-severity-severe/15 border-severity-severe/50"
                              }`}
                            >
                              {o.severity}
                            </span>
                            <span className="text-[9px] text-muted-foreground">Decay: {Math.round(o.decay * 100)}%</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/80 leading-relaxed">{o.cause}</p>
                          <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
                            <p className="text-[10px] text-foreground/90">{o.advice}</p>
                          </div>
                          {o.treatmentResponse && o.treatmentResponse.isReceivingTreatment && (
                            <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2 space-y-1">
                              <div className="flex items-center gap-1">
                                <Syringe className="h-3 w-3 text-green-400" />
                                <span className="text-[9px] font-semibold uppercase text-green-400">Treatment Active</span>
                              </div>
                              <div className="flex justify-between text-[9px]">
                                <span className="text-muted-foreground">Improvement</span>
                                <span className="text-green-400 font-mono">+{o.treatmentResponse.healthImprovement}</span>
                              </div>
                              <div className="flex justify-between text-[9px]">
                                <span className="text-muted-foreground">Recovery</span>
                                <span className="text-primary font-mono">{o.treatmentResponse.projectedRecovery}/100</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Body Metrics Summary */}
                <div className="border-t border-border/40 pt-2 mt-2">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Body Metrics</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "BMI", value: state.body.bmi.toFixed(1) },
                      { label: "Fatigue", value: `${(state.body.fatigue * 100).toFixed(0)}%` },
                      { label: "Skin Dull", value: `${(state.body.skinDull * 100).toFixed(0)}%` },
                      { label: "Posture", value: `${(state.body.posture * 100).toFixed(0)}%` },
                      { label: "Dark Circles", value: `${(state.body.darkCircles * 100).toFixed(0)}%` },
                      { label: "Breathing", value: `${(state.body.breathing * 100).toFixed(0)}%` },
                    ].map((m) => (
                      <div key={m.label} className="flex items-center justify-between rounded-md bg-secondary/20 px-2 py-1">
                        <span className="text-[9px] text-muted-foreground">{m.label}</span>
                        <span className="font-mono text-[10px] text-foreground">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
