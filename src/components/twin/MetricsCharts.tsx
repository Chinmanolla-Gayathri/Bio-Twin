"use client";

import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { simulate } from "@/lib/twin-engine";
import type { TwinInputs, ActiveTreatment } from "@/lib/twin-types";

interface Props {
  inputs: TwinInputs;
  currentDay: number;
  activeTreatments?: ActiveTreatment[];
}

export default function MetricsCharts({ inputs, currentDay, activeTreatments = [] }: Props) {
  const data = useMemo(() => {
    const out = [];
    const heightM = inputs.height / 100;
    for (let d = 0; d <= 60; d += 2) {
      const s = simulate(inputs, d, activeTreatments);
      const projectedWeight = s.body.bmi * heightM * heightM;
      // Average organ health score
      const organScores = Object.values(s.organs).map((o) => o.healthScore);
      const avgHealth = Math.round(organScores.reduce((a, b) => a + b, 0) / organScores.length);
      // Treatment improvement
      const txImprovement = s.treatmentEffects?.totalImprovement || 0;
      out.push({
        day: d,
        weight: +projectedWeight.toFixed(1),
        fatigue: +(s.body.fatigue * 100).toFixed(0),
        health: avgHealth,
        txEffect: txImprovement,
      });
    }
    return out;
  }, [inputs, activeTreatments]);

  const tip = (color: string) => ({
    contentStyle: {
      background: "oklch(0.18 0.025 240 / 0.95)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      fontSize: 11,
      color: "var(--foreground)",
    },
    cursor: { stroke: color, strokeOpacity: 0.3 },
  });

  const charts = [
    { title: "Weight", key: "weight", color: "var(--cyan)", suffix: " kg" },
    { title: "Fatigue", key: "fatigue", color: "var(--amber)", suffix: "%" },
    { title: "Avg Health", key: "health", color: "var(--mint)", suffix: "" },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2">
      {charts.map((c) => {
        const current = data.find((d) => d.day >= currentDay) ?? data[data.length - 1];
        return (
          <div key={c.key} className="panel p-2.5">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.title}
              </span>
              <span className="font-mono text-xs" style={{ color: c.color }}>
                {(current as Record<string, number>)[c.key]}{c.suffix}
              </span>
            </div>
            <div className="h-14">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`g-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.color} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip {...tip(c.color)} formatter={(v: number) => [`${v}${c.suffix}`, c.title]} labelFormatter={(l) => `Day ${l}`} />
                  <Area
                    type="monotone"
                    dataKey={c.key}
                    stroke={c.color}
                    strokeWidth={2}
                    fill={`url(#g-${c.key})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
