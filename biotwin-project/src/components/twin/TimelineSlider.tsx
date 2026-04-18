"use client";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

interface Props {
  day: number;
  setDay: (d: number) => void;
  playing: boolean;
  setPlaying: (b: boolean) => void;
}

export default function TimelineSlider({ day, setDay, playing, setPlaying }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX: Use a simpler approach - just use useEffect with day dependency
  // but throttle re-creation to avoid performance issues
  useEffect(() => {
    if (!playing) {
      return;
    }

    if (day >= 60) {
      setPlaying(false);
      return;
    }

    const id = setTimeout(() => {
      setDay(Math.min(60, day + 0.5));
    }, 80);

    timerRef.current = id;

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [playing, day, setDay, setPlaying]);

  return (
    <div className="panel flex items-center gap-4 px-5 py-3">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full"
          onClick={() => { setPlaying(false); setDay(0); }}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Future Projection
          </span>
          <span className="font-mono text-sm text-foreground">
            Day <span className="text-gradient text-lg font-bold">{Math.round(day)}</span> / 60
          </span>
        </div>
        <Slider value={[day]} min={0} max={60} step={1} onValueChange={(v) => setDay(v[0])} />
        <div className="flex justify-between text-[10px] text-muted-foreground/70">
          <span>Today</span>
          <span>2 weeks</span>
          <span>1 month</span>
          <span>2 months</span>
        </div>
      </div>
    </div>
  );
}
