"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { fmt } from "@/lib/format";
import type { ProfileSample, PropagationOk } from "@/lib/propagation";
import { cn } from "@/lib/utils";

function niceTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

function ProfileTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const s = payload[0]?.payload as ProfileSample | undefined;
  if (!s) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium tabular-nums">
        {fmt(s.d, 2)} км от передатчика
      </div>
      <div className="space-y-0.5 tabular-nums text-muted-foreground">
        <div className="flex justify-between gap-6">
          <span>Рельеф</span>
          <span className="text-foreground">{fmt(s.terrainEff, 0)} м</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Луч визирования</span>
          <span className="text-foreground">{fmt(s.los, 0)} м</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Просвет</span>
          <span
            className={
              s.clearance >= 0
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : "font-medium text-red-600 dark:text-red-400"
            }
          >
            {fmt(s.clearance, 1)} м
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Радиус зоны Френеля F₁</span>
          <span className="text-foreground">{fmt(s.fresnel, 1)} м</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Просвет / F₁</span>
          <span className="text-foreground">
            {Number.isFinite(s.ratio) ? `${fmt(s.ratio * 100, 0)} %` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function LegendSwatch({ className }: { className: string }) {
  return <span aria-hidden className={cn("inline-block", className)} />;
}

export function ProfileChart({ result }: { result: PropagationOk }) {
  const { samples, txGroundM, rxGroundM, txAntM, rxAntM, distanceKm } = result;

  const terrainMin = Math.min(
    ...samples.map((s) => s.terrain),
    txGroundM,
    rxGroundM
  );
  const terrainMax = Math.max(
    ...samples.map((s) => s.terrain),
    txAntM,
    rxAntM
  );
  const span = Math.max(terrainMax - terrainMin, 10);
  const yDomain: [number, number] = [
    terrainMin - span * 0.06,
    terrainMax + span * 0.22,
  ];

  const worst = samples.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
  const worstIsViolation = worst.ratio < 0.6 || worst.clearance < 0;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <LegendSwatch className="h-2.5 w-4 rounded-sm bg-muted-foreground/40" />
          Рельеф (с рефракцией)
        </span>
        <span className="flex items-center gap-1.5">
          <LegendSwatch className="h-0 w-5 border-t-2 border-dashed border-primary" />
          Луч визирования
        </span>
        <span className="flex items-center gap-1.5">
          <LegendSwatch className="h-0 w-5 border-t-2 border-dotted border-teal-600 dark:border-teal-400" />
          Границы 1-й зоны Френеля
        </span>
      </div>
      <div className="h-[320px] w-full sm:h-[400px]" role="img" aria-label="Профиль трассы: рельеф, луч визирования и первая зона Френеля">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={samples} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="terrainFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.28} />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="d"
              type="number"
              domain={[0, distanceKm]}
              ticks={niceTicks(distanceKm)}
              tickMargin={6}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              domain={yDomain}
              width={48}
              tickCount={6}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v: number) => String(Math.round(v))}
              stroke="hsl(var(--border))"
              label={{
                value: "м",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
              }}
            />
            <Tooltip content={<ProfileTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
            <Area
              type="monotone"
              dataKey="terrain"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              fill="url(#terrainFill)"
              baseLine={yDomain[0]}
              isAnimationActive={false}
              dot={false}
            />
            <Line
              type="linear"
              dataKey="fresnelLow"
              stroke="#0d9488"
              strokeWidth={1.2}
              strokeDasharray="2 4"
              strokeOpacity={0.9}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="fresnelHigh"
              stroke="#0d9488"
              strokeWidth={1.2}
              strokeDasharray="2 4"
              strokeOpacity={0.35}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="los"
              stroke="hsl(var(--primary))"
              strokeWidth={1.8}
              strokeDasharray="7 5"
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={0}
              y={txAntM}
              r={4}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
              label={{
                value: "ПД",
                position: "top",
                fontSize: 11,
                fill: "hsl(var(--foreground))",
              }}
            />
            <ReferenceDot
              x={distanceKm}
              y={rxAntM}
              r={4}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
              label={{
                value: "ПР",
                position: "top",
                fontSize: 11,
                fill: "hsl(var(--foreground))",
              }}
            />
            <ReferenceDot
              x={worst.d}
              y={worst.terrainEff}
              r={4.5}
              fill={worstIsViolation ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"}
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
              label={{
                value: `просвет ${fmt(worst.clearance, 0)} м`,
                position: worst.clearance >= 0 ? "top" : "bottom",
                fontSize: 11,
                fontWeight: 600,
                fill: worstIsViolation
                  ? "hsl(var(--destructive))"
                  : "hsl(var(--muted-foreground))",
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
