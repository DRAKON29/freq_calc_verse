"use client";

import * as React from "react";
import { Upload } from "lucide-react";

import { NumberInput } from "@/components/rf/number-input";
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
  HgtParseError,
  parseHgt,
  profileFromHgt,
  type HgtTile,
} from "@/lib/hgt";
import { fmt } from "@/lib/format";
import { geodesicInverse, type LatLng } from "@/lib/geo";
import type { TerrainPoint } from "@/lib/propagation";
import { cn } from "@/lib/utils";

const DEFAULT_A: LatLng = { lat: 55.7558, lon: 37.6173 };
const DEFAULT_B: LatLng = { lat: 55.86, lon: 37.9 };

type UploadStatus =
  | { kind: "ok"; text: string; warn?: string }
  | { kind: "error"; text: string };

interface CoordinateFieldProps {
  label: string;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
}

function CoordinateField({
  label,
  ariaLabel,
  value,
  min,
  max,
  onValueChange,
}: CoordinateFieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <NumberInput
        value={value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onValueChange={onValueChange}
        className="h-8 w-full"
      />
    </div>
  );
}

export function TerrainUpload({
  onTerrain,
}: {
  onTerrain: (points: TerrainPoint[]) => void;
}) {
  const [latA, setLatA] = React.useState(DEFAULT_A.lat);
  const [lonA, setLonA] = React.useState(DEFAULT_A.lon);
  const [latB, setLatB] = React.useState(DEFAULT_B.lat);
  const [lonB, setLonB] = React.useState(DEFAULT_B.lon);
  const [tiles, setTiles] = React.useState<HgtTile[]>([]);
  const [status, setStatus] = React.useState<UploadStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const pointA: LatLng = { lat: latA, lon: lonA };
  const pointB: LatLng = { lat: latB, lon: lonB };
  const preview = React.useMemo(
    () => geodesicInverse({ lat: latA, lon: lonA }, { lat: latB, lon: lonB }),
    [latA, lonA, latB, lonB]
  );

  const buildProfile = (loadedTiles: HgtTile[]): UploadStatus => {
    try {
      const profile = profileFromHgt(loadedTiles, pointA, pointB);
      onTerrain(profile.points);
      const warn =
        profile.missingRatio > 0
          ? `Пустоты данных (${fmt(profile.missingRatio * 100, 0)} % точек) заполнены интерполяцией.`
          : undefined;
      return {
        kind: "ok",
        text: `Профиль построен: ${fmt(profile.distanceKm, 2)} км, азимут ${fmt(profile.azimuthDeg, 1)}°, ${profile.points.length} точек.`,
        warn,
      };
    } catch (e) {
      return {
        kind: "error",
        text: e instanceof HgtParseError ? e.message : "Не удалось построить профиль.",
      };
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const loaded: HgtTile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (!/\.hgt$/i.test(file.name)) {
        errors.push(`«${file.name}»: ожидаются файлы .hgt (SRTM).`);
        continue;
      }
      try {
        const buffer = await file.arrayBuffer();
        loaded.push(parseHgt(file.name, buffer));
      } catch (e) {
        errors.push(
          e instanceof HgtParseError ? e.message : `«${file.name}»: файл не читается.`
        );
      }
    }

    let finalStatus: UploadStatus;
    if (loaded.length > 0) {
      setTiles(loaded);
      finalStatus = buildProfile(loaded);
      if (errors.length > 0) {
        const errText = errors.join(" ");
        finalStatus =
          finalStatus.kind === "ok"
            ? {
                ...finalStatus,
                warn: finalStatus.warn
                  ? `${finalStatus.warn} ${errText}`
                  : errText,
              }
            : { kind: "error", text: `${finalStatus.text} ${errText}` };
      }
    } else {
      finalStatus = {
        kind: "error",
        text: errors.join(" ") || "Файлы не распознаны.",
      };
    }
    setStatus(finalStatus);
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const rebuild = () => {
    if (tiles.length === 0) return;
    setStatus(buildProfile(tiles));
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Рельеф по координатам</CardTitle>
        <CardDescription>
          Точки A (ПД) и B (ПР) в градусах WGS-84, профиль — вдоль ортодромии
          из листов SRTM (.hgt)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Точка A — передатчик</div>
            <CoordinateField
              label="Широта, °"
              ariaLabel="Широта точки A, градусы"
              value={latA}
              min={-90}
              max={90}
              onValueChange={setLatA}
            />
            <CoordinateField
              label="Долгота, °"
              ariaLabel="Долгота точки A, градусы"
              value={lonA}
              min={-180}
              max={180}
              onValueChange={setLonA}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Точка B — приёмник</div>
            <CoordinateField
              label="Широта, °"
              ariaLabel="Широта точки B, градусы"
              value={latB}
              min={-90}
              max={90}
              onValueChange={setLatB}
            />
            <CoordinateField
              label="Долгота, °"
              ariaLabel="Долгота точки B, градусы"
              value={lonB}
              min={-180}
              max={180}
              onValueChange={setLonB}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {preview && preview.distanceM >= 1
            ? `Расстояние A–B: ${fmt(preview.distanceM / 1000, 2)} км · азимут ${fmt(preview.azFwdDeg, 1)}°`
            : "Укажите две разные точки"}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Загрузить .hgt
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={tiles.length === 0 || busy}
            onClick={rebuild}
          >
            Перестроить профиль
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".hgt"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>

        {tiles.length > 0 && (
          <p className="text-[11px] leading-tight text-muted-foreground">
            Листы: {tiles.map((t) => t.name).join(", ")}
          </p>
        )}

        {status && (
          <div
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs leading-snug",
              status.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
            )}
          >
            <p>{status.text}</p>
            {status.kind === "ok" && status.warn ? <p>{status.warn}</p> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
