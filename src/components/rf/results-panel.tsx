"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { fmt, fmtSigned } from "@/lib/format";
import type { LinkConfig, PropagationOk } from "@/lib/propagation";
import { cn } from "@/lib/utils";

type LinkStatus = "good" | "marginal" | "fail";

const STATUS: Record<
  LinkStatus,
  { label: string; hint: string; badgeCls: string; Icon: LucideIcon }
> = {
  good: {
    label: "Устойчивая связь",
    hint: "Сигнал уверенно превышает чувствительность приёмника.",
    badgeCls:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  marginal: {
    label: "На пределе",
    hint: "Связь возможна, но без запаса — вероятны замирания и пропадания.",
    badgeCls:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  fail: {
    label: "Связь отсутствует",
    hint: "Уровень сигнала ниже чувствительности приёмника: увеличьте мощность, высоту антенн, усиление или уменьшите дальность.",
    badgeCls: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    Icon: XCircle,
  },
};

function statusOf(marginDb: number): LinkStatus {
  if (marginDb >= 10) return "good";
  if (marginDb >= 0) return "marginal";
  return "fail";
}

function MetricRow({
  label,
  value,
  hint,
  valueCls,
}: {
  label: string;
  value: string;
  hint?: string;
  valueCls?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint ? (
          <div className="text-[11px] leading-tight text-muted-foreground">{hint}</div>
        ) : null}
      </div>
      <div className={cn("shrink-0 text-sm font-semibold tabular-nums", valueCls)}>
        {value}
      </div>
    </div>
  );
}

function FresnelVerdict({ result }: { result: PropagationOk }) {
  if (!result.losClear) {
    return (
      <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-700 dark:text-red-400">
        Прямая видимость отсутствует — рельеф перекрывает луч.
      </p>
    );
  }
  if (result.worstRatio < 0.6) {
    return (
      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
        Первая зона Френеля перекрыта рельефом — поднимите антенны для запаса ≥ 60 %.
      </p>
    );
  }
  return null;
}

export function ResultsPanel({
  result,
  config,
}: {
  result: PropagationOk;
  config: LinkConfig;
}) {
  const status = statusOf(result.marginDb);
  const meta = STATUS[status];
  const marginCls =
    status === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : status === "marginal"
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4",
          meta.badgeCls
        )}
      >
        <div className="flex items-center gap-3">
          <meta.Icon className="h-8 w-8 shrink-0" aria-hidden />
          <div>
            <div className="text-base font-semibold leading-tight">{meta.label}</div>
            <div className="text-xs leading-snug opacity-90">{meta.hint}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide opacity-80">
            Запас по чувствительности
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {fmtSigned(result.marginDb, 1)} дБ
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-semibold">Сигнал и потери</h3>
          <MetricRow
            label="Уровень на входе приёмника"
            value={`${fmt(result.rxLevelDbm, 1)} дБм`}
            valueCls={marginCls}
          />
          <MetricRow
            label="Полные потери на трассе"
            value={`${fmt(result.totalLossDb, 1)} дБ`}
          />
          <MetricRow
            label="Потери в свободном пространстве"
            value={`${fmt(result.fsplDb, 1)} дБ`}
            hint="FSPL, ITU-R P.525"
          />
          <MetricRow
            label="Дифракционные потери"
            value={`${fmt(result.diffractionDb, 1)} дБ`}
            hint={
              result.obstructionCount > 0
                ? `клинья по ITU-R P.526, препятствий: ${result.obstructionCount}`
                : "препятствий над лучом нет"
            }
          />
          <MetricRow label="EIRP" value={`${fmt(result.eirpDbm, 1)} дБм`} />
          <MetricRow
            label="Чувствительность приёмника"
            value={`${fmt(config.rxSensitivityDbm, 0)} дБм`}
          />
        </div>

        <div className="rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-semibold">Геометрия трассы</h3>
          <MetricRow
            label="Прямая видимость"
            value={result.losClear ? "есть" : "нет"}
            valueCls={
              result.losClear
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }
          />
          <MetricRow label="Дальность" value={`${fmt(result.distanceKm, 2)} км`} />
          <MetricRow
            label="Минимальный просвет"
            value={`${fmt(result.minClearanceM, 1)} м`}
            hint={`на ${fmt(result.minClearanceAtKm, 2)} км`}
          />
          <MetricRow
            label="Радиус F₁ в худшей точке"
            value={`${fmt(result.fresnelAtWorstM, 1)} м`}
            hint={`на ${fmt(result.worstRatioAtKm, 2)} км`}
          />
          <MetricRow
            label="Запас по зоне Френеля"
            value={`${fmt(result.worstRatio * 100, 0)} % F₁`}
            hint="требуется ≥ 60 %"
            valueCls={
              result.worstRatio >= 0.6
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }
          />
          <MetricRow
            label="Длина волны"
            value={`${fmt(result.wavelengthM, 2)} м`}
          />
          <div className="mt-2">
            <FresnelVerdict result={result} />
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Модель: потери в свободном пространстве (ITU-R P.525) плюс дифракция на
        клиновидных препятствиях рельефа (ITU-R P.526, метод Эпштейна–Петерсона);
        кривизна Земли учтена фактором рефракции k. Высоты антенн отсчитываются от
        рельефа в точках установки. Оценка для планирования — не заменяет детальное
        прогнозирование распространения.
      </p>
    </div>
  );
}
