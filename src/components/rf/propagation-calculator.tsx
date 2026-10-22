"use client";

import * as React from "react";
import { RadioTower } from "lucide-react";

import { NumberInput } from "@/components/rf/number-input";
import {
  FrequencyCompareCard,
  FrequencyListEditor,
  type FrequencyCompareRow,
} from "@/components/rf/frequency-compare";
import { ProfileChart } from "@/components/rf/profile-chart";
import { ResultsPanel } from "@/components/rf/results-panel";
import { TerrainUpload } from "@/components/rf/terrain-upload";
import {
  TERRAIN_PRESETS,
  TerrainEditor,
  type TerrainPointUI,
} from "@/components/rf/terrain-editor";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmt } from "@/lib/format";
import {
  calculateLink,
  wavelengthM,
  type LinkConfig,
  type TerrainPoint,
} from "@/lib/propagation";

const FREQUENCY_PRESETS = [144, 433, 868, 1800, 2400, 5800];

const DEFAULT_FREQ_LIST = [433, 868, 2400];
/** Максимум точек, показываемых в таблице редактора (полный профиль учитывается в расчёте) */
const EDITOR_MAX_POINTS = 32;

const K_OPTIONS = [
  { value: "0.67", label: "k = 2/3 — субрефракция", k: 2 / 3 },
  { value: "1", label: "k = 1 — нейтральная атмосфера", k: 1 },
  { value: "1.33", label: "k = 4/3 — стандартная", k: 4 / 3 },
  { value: "2", label: "k = 2 — суперрефракция", k: 2 },
];

const DEFAULT_CONFIG: LinkConfig = {
  freqMHz: 868,
  txHeightM: 25,
  rxHeightM: 5,
  txPowerDbm: 20,
  txGainDbi: 2,
  rxGainDbi: 2,
  rxSensitivityDbm: -100,
  kFactor: 4 / 3,
};

const INITIAL_TERRAIN: TerrainPointUI[] = [
  { id: "init-0", d: 0, h: 50 },
  { id: "init-1", d: 10, h: 50 },
];

let pointSeq = 0;
const nextPointId = () => `pt-${++pointSeq}`;

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm">
          {label}
        </Label>
        {hint ? (
          <div className="text-[11px] leading-tight text-muted-foreground">{hint}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function PropagationCalculator() {
  const [config, setConfig] = React.useState<LinkConfig>(DEFAULT_CONFIG);
  const [terrain, setTerrain] = React.useState<TerrainPointUI[]>(INITIAL_TERRAIN);
  const [freqList, setFreqList] = React.useState<number[]>(DEFAULT_FREQ_LIST);

  const result = React.useMemo(
    () =>
      calculateLink(
        config,
        terrain.map(({ d, h }) => ({ d, h }))
      ),
    [config, terrain]
  );

  const terrainPoints = React.useMemo(
    () => terrain.map(({ d, h }) => ({ d, h }) as TerrainPoint),
    [terrain]
  );

  const compareRows = React.useMemo<FrequencyCompareRow[]>(() => {
    const unique = [...new Set(freqList)].filter(
      (f) => Number.isFinite(f) && f > 0
    );
    unique.sort((a, b) => a - b);
    return unique.map((freqMHz) => {
      const res =
        freqMHz === config.freqMHz
          ? result
          : calculateLink({ ...config, freqMHz }, terrainPoints);
      if (!res.ok) {
        return {
          freqMHz,
          fsplDb: NaN,
          diffractionDb: NaN,
          totalLossDb: NaN,
          rxLevelDbm: NaN,
          marginDb: NaN,
          primary: freqMHz === config.freqMHz,
        };
      }
      return {
        freqMHz,
        fsplDb: res.fsplDb,
        diffractionDb: res.diffractionDb,
        totalLossDb: res.totalLossDb,
        rxLevelDbm: res.rxLevelDbm,
        marginDb: res.marginDb,
        primary: freqMHz === config.freqMHz,
      };
    });
  }, [config, result, terrainPoints, freqList]);

  const patchConfig = (patch: Partial<LinkConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

  const updatePoint = (id: string, patch: Partial<Omit<TerrainPointUI, "id">>) =>
    setTerrain((ts) => ts.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  /** Сортировка и нормализация расстояний после правки */
  const commitOrder = React.useCallback(() => {
    setTerrain((ts) => {
      const sorted = [...ts].sort((a, b) => a.d - b.d);
      const last = sorted.length - 1;
      return sorted.map((p, i) => {
        if (i === 0) return { ...p, d: 0 };
        if (i === last) return p;
        return { ...p, d: Math.min(Math.max(p.d, 0.001), sorted[last].d - 0.001) };
      });
    });
  }, []);

  const addPoint = React.useCallback(() => {
    setTerrain((ts) => {
      if (ts.length >= 32) return ts;
      const sorted = [...ts].sort((a, b) => a.d - b.d);
      let gapIdx = 1;
      let gap = -1;
      for (let i = 1; i < sorted.length; i++) {
        const g = sorted[i].d - sorted[i - 1].d;
        if (g > gap) {
          gap = g;
          gapIdx = i;
        }
      }
      const a = sorted[gapIdx - 1];
      const b = sorted[gapIdx];
      const d = Math.round(((a.d + b.d) / 2) * 100) / 100;
      const h = Math.round(a.h + (b.h - a.h) * ((d - a.d) / (b.d - a.d)));
      return [...ts, { id: nextPointId(), d, h }];
    });
  }, []);

  const removePoint = React.useCallback((id: string) => {
    setTerrain((ts) => ts.filter((p) => p.id !== id));
  }, []);

  const applyPreset = React.useCallback((presetId: string) => {
    const preset = TERRAIN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTerrain(preset.points.map((p, i) => ({ id: `${preset.id}-${i}`, ...p })));
  }, []);

  /** Профиль, построенный по координатам из файла рельефа */
  const applyUploadedTerrain = React.useCallback((points: TerrainPoint[]) => {
    setTerrain(points.map((p) => ({ id: nextPointId(), d: p.d, h: p.h })));
  }, []);

  const distanceKm = result.ok ? result.distanceKm : 0;
  const lambda = config.freqMHz > 0 ? wavelengthM(config.freqMHz) : NaN;
  const txPowerMw = 10 ** (config.txPowerDbm / 10);
  const editorPoints = terrain.slice(0, EDITOR_MAX_POINTS);
  const hiddenPoints = Math.max(0, terrain.length - EDITOR_MAX_POINTS);

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* Левая колонка — параметры */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <RadioTower className="h-4 w-4 text-muted-foreground" />
                Радиопараметры
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Field label="Частота" htmlFor="freq" hint={`λ ≈ ${fmt(lambda, 2)} м`}>
                  <NumberInput
                    id="freq"
                    value={config.freqMHz}
                    min={0.1}
                    max={100000}
                    onValueChange={(freqMHz) => patchConfig({ freqMHz })}
                    className="w-28"
                  />
                </Field>
                <div className="flex flex-wrap gap-1">
                  {FREQUENCY_PRESETS.map((f) => (
                    <Button
                      key={f}
                      type="button"
                      variant={config.freqMHz === f ? "secondary" : "outline"}
                      size="sm"
                      className="h-6 px-2 text-[11px] tabular-nums"
                      onClick={() => patchConfig({ freqMHz: f })}
                    >
                      {f < 1000 ? `${f}` : `${f / 1000} Г`}
                    </Button>
                  ))}
                </div>
              </div>

              <Field
                label="Мощность передатчика"
                htmlFor="ptx"
                hint={`≈ ${fmt(txPowerMw, txPowerMw >= 100 ? 0 : 1)} мВт`}
              >
                <NumberInput
                  id="ptx"
                  value={config.txPowerDbm}
                  min={-30}
                  max={60}
                  onValueChange={(txPowerDbm) => patchConfig({ txPowerDbm })}
                  className="w-28"
                />
              </Field>

              <Field label="Усиление антенны ПД" htmlFor="gtx">
                <NumberInput
                  id="gtx"
                  value={config.txGainDbi}
                  min={-10}
                  max={90}
                  onValueChange={(txGainDbi) => patchConfig({ txGainDbi })}
                  className="w-28"
                />
              </Field>

              <Field label="Усиление антенны ПР" htmlFor="grx">
                <NumberInput
                  id="grx"
                  value={config.rxGainDbi}
                  min={-10}
                  max={90}
                  onValueChange={(rxGainDbi) => patchConfig({ rxGainDbi })}
                  className="w-28"
                />
              </Field>

              <Field
                label="Чувствительность приёмника"
                htmlFor="sens"
              >
                <NumberInput
                  id="sens"
                  value={config.rxSensitivityDbm}
                  min={-200}
                  max={0}
                  onValueChange={(rxSensitivityDbm) => patchConfig({ rxSensitivityDbm })}
                  className="w-28"
                />
              </Field>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="kfactor" className="text-sm">
                  Рефракция атмосферы
                </Label>
                <Select
                  value={
                    K_OPTIONS.find((o) => Math.abs(o.k - config.kFactor) < 0.01)
                      ?.value ?? "1.33"
                  }
                  onValueChange={(v) =>
                    patchConfig({ kFactor: K_OPTIONS.find((o) => o.value === v)?.k ?? 4 / 3 })
                  }
                >
                  <SelectTrigger id="kfactor" className="w-[240px]">
                    <SelectValue placeholder="Фактор k" />
                  </SelectTrigger>
                  <SelectContent>
                    {K_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Антенны</CardTitle>
              <CardDescription>
                Высота над рельефом в точке установки
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Антенна ПД, м" htmlFor="h1">
                <NumberInput
                  id="h1"
                  value={config.txHeightM}
                  min={0}
                  max={500}
                  onValueChange={(txHeightM) => patchConfig({ txHeightM })}
                  className="w-28"
                />
              </Field>
              <Field label="Антенна ПР, м" htmlFor="h2">
                <NumberInput
                  id="h2"
                  value={config.rxHeightM}
                  min={0}
                  max={500}
                  onValueChange={(rxHeightM) => patchConfig({ rxHeightM })}
                  className="w-28"
                />
              </Field>
            </CardContent>
          </Card>

          <FrequencyCompareCard rows={compareRows}>
            <FrequencyListEditor
              frequencies={freqList}
              onChange={setFreqList}
            />
          </FrequencyCompareCard>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Профиль рельефа</CardTitle>
              <CardDescription>
                Трасса {fmt(distanceKm, 2)} км · {terrain.length} точек · рельеф
                правится построчно
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TerrainEditor
                points={editorPoints}
                hiddenCount={hiddenPoints}
                onDistanceChange={(id, d) => updatePoint(id, { d })}
                onElevationChange={(id, h) => updatePoint(id, { h })}
                onCommitOrder={commitOrder}
                onAdd={addPoint}
                onRemove={removePoint}
                onPreset={applyPreset}
              />
            </CardContent>
          </Card>

          <TerrainUpload onTerrain={applyUploadedTerrain} />
        </div>

        {/* Правая колонка — график и результат */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Разрез трассы</CardTitle>
              <CardDescription>
                Луч визирования и первая зона Френеля над рельефом
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.ok ? (
                <ProfileChart result={result} />
              ) : (
                <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  Исправьте параметры, чтобы увидеть разрез трассы
                </div>
              )}
            </CardContent>
          </Card>

          {result.ok ? (
            <ResultsPanel result={result} config={config} />
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Проверьте параметры</AlertTitle>
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
