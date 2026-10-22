"use client";

import { Plus, Trash2 } from "lucide-react";

import { NumberInput } from "@/components/rf/number-input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface TerrainPointUI {
  id: string;
  /** км от передатчика */
  d: number;
  /** высота рельефа, м */
  h: number;
}

export interface TerrainPreset {
  id: string;
  label: string;
  points: Array<{ d: number; h: number }>;
}

export const TERRAIN_PRESETS: TerrainPreset[] = [
  {
    id: "flat",
    label: "Равнина",
    points: [
      { d: 0, h: 50 },
      { d: 10, h: 50 },
    ],
  },
  {
    id: "hill",
    label: "Холм",
    points: [
      { d: 0, h: 50 },
      { d: 3.5, h: 58 },
      { d: 5, h: 140 },
      { d: 6.5, h: 60 },
      { d: 10, h: 48 },
    ],
  },
  {
    id: "two-hills",
    label: "Два холма",
    points: [
      { d: 0, h: 60 },
      { d: 4, h: 85 },
      { d: 7, h: 200 },
      { d: 10, h: 75 },
      { d: 13, h: 180 },
      { d: 16, h: 80 },
      { d: 20, h: 62 },
    ],
  },
  {
    id: "valley",
    label: "Долина",
    points: [
      { d: 0, h: 120 },
      { d: 4, h: 95 },
      { d: 6.5, h: 45 },
      { d: 8, h: 25 },
      { d: 9.5, h: 50 },
      { d: 12, h: 95 },
      { d: 15, h: 110 },
    ],
  },
  {
    id: "mountains",
    label: "Горы",
    points: [
      { d: 0, h: 300 },
      { d: 5, h: 350 },
      { d: 10, h: 700 },
      { d: 15, h: 1100 },
      { d: 20, h: 650 },
      { d: 25, h: 400 },
      { d: 30, h: 280 },
    ],
  },
];

const MAX_POINTS = 32;

interface TerrainEditorProps {
  points: TerrainPointUI[];
  onDistanceChange: (id: string, d: number) => void;
  onElevationChange: (id: string, h: number) => void;
  /** Сортировка и нормализация после правки расстояний */
  onCommitOrder: () => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPreset: (presetId: string) => void;
}

export function TerrainEditor({
  points,
  onDistanceChange,
  onElevationChange,
  onCommitOrder,
  onAdd,
  onRemove,
  onPreset,
}: TerrainEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TERRAIN_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => onPreset(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 w-10 pl-3 text-xs">Точка</TableHead>
              <TableHead className="h-8 text-xs">Расстояние, км</TableHead>
              <TableHead className="h-8 pr-3 text-xs">Рельеф, м</TableHead>
              <TableHead className="h-8 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point, index) => {
              const isFirst = index === 0;
              const isLast = index === points.length - 1;
              const isEndpoint = isFirst || isLast;
              return (
                <TableRow key={point.id}>
                  <TableCell className="py-1.5 pl-3">
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-8 items-center justify-center rounded px-1.5 text-[11px] font-semibold",
                        isFirst && "bg-primary/10 text-primary",
                        isLast && "bg-primary/10 text-primary",
                        !isEndpoint && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isFirst ? "ПД" : isLast ? "ПР" : index}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <NumberInput
                      value={point.d}
                      min={0}
                      onValueChange={(d) => onDistanceChange(point.id, d)}
                      onCommit={() => onCommitOrder()}
                      disabled={isFirst}
                      aria-label={
                        isFirst
                          ? "Расстояние передатчика (0 км)"
                          : "Расстояние точки от передатчика, км"
                      }
                      className="h-8 w-20"
                    />
                  </TableCell>
                  <TableCell className="py-1.5 pr-3">
                    <NumberInput
                      value={point.h}
                      min={-200}
                      max={10000}
                      onValueChange={(h) => onElevationChange(point.id, h)}
                      aria-label="Высота рельефа, м"
                      className="h-8 w-20"
                    />
                  </TableCell>
                  <TableCell className="py-1.5 pr-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={isEndpoint}
                      onClick={() => onRemove(point.id)}
                      aria-label="Удалить точку"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8"
          disabled={points.length >= MAX_POINTS}
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить точку
        </Button>
        <p className="text-right text-[11px] leading-tight text-muted-foreground">
          ПД — передатчик, ПР — приёмник.
          <br />
          Дальность задаётся расстоянием точки ПР.
        </p>
      </div>
    </div>
  );
}
