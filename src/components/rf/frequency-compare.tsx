"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { NumberInput } from "@/components/rf/number-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmt, fmtSigned } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_FREQUENCIES = 8;

export interface FrequencyCompareRow {
  freqMHz: number;
  fsplDb: number;
  diffractionDb: number;
  totalLossDb: number;
  rxLevelDbm: number;
  marginDb: number;
  /** Основная частота (для неё строится график) */
  primary: boolean;
}

export function FrequencyListEditor({
  frequencies,
  onChange,
}: {
  frequencies: number[];
  onChange: (next: number[]) => void;
}) {
  const update = (index: number, value: number) =>
    onChange(frequencies.map((f, i) => (i === index ? value : f)));

  const remove = (index: number) =>
    onChange(frequencies.filter((_, i) => i !== index));

  const add = () => {
    if (frequencies.length >= MAX_FREQUENCIES) return;
    const last = frequencies[frequencies.length - 1];
    onChange([...frequencies, Number.isFinite(last) ? last : 868]);
  };

  return (
    <div className="space-y-2">
      {frequencies.map((freq, index) => (
        <div key={index} className="flex items-center gap-2">
          <NumberInput
            value={freq}
            min={0.1}
            max={100000}
            aria-label={`Частота ${index + 1}, МГц`}
            onValueChange={(v) => update(index, v)}
            className="h-8 flex-1"
          />
          <span className="w-8 shrink-0 text-xs text-muted-foreground">МГц</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={frequencies.length <= 1}
            onClick={() => remove(index)}
            aria-label={`Удалить частоту ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8"
        disabled={frequencies.length >= MAX_FREQUENCIES}
        onClick={add}
      >
        <Plus className="h-3.5 w-3.5" />
        Добавить частоту
      </Button>
    </div>
  );
}

function marginCls(marginDb: number): string {
  if (marginDb >= 10) return "text-emerald-600 dark:text-emerald-400";
  if (marginDb >= 0) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function FrequencyCompareTable({ rows }: { rows: FrequencyCompareRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 pl-3 text-xs">Частота</TableHead>
            <TableHead className="h-8 text-xs">FSPL</TableHead>
            <TableHead className="h-8 text-xs">Дифракция</TableHead>
            <TableHead className="h-8 text-xs">Уровень</TableHead>
            <TableHead className="h-8 pr-3 text-right text-xs">Запас</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.freqMHz}
              className={cn(row.primary && "bg-muted/40")}
            >
              <TableCell className="py-1.5 pl-3 font-medium tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  {fmt(row.freqMHz, Number.isInteger(row.freqMHz) ? 0 : 2)}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    МГц
                  </span>
                  {row.primary && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      основная
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="py-1.5 tabular-nums">
                {fmt(row.fsplDb, 1)}
              </TableCell>
              <TableCell className="py-1.5 tabular-nums">
                {fmt(row.diffractionDb, 1)}
              </TableCell>
              <TableCell className="py-1.5 tabular-nums">
                {fmt(row.rxLevelDbm, 1)} дБм
              </TableCell>
              <TableCell
                className={cn(
                  "py-1.5 pr-3 text-right font-semibold tabular-nums",
                  marginCls(row.marginDb)
                )}
              >
                {fmtSigned(row.marginDb, 1)} дБ
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function FrequencyCompareCard({
  rows,
  children,
}: {
  rows: FrequencyCompareRow[];
  /** Редактор списка частот */
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Сравнение частот</CardTitle>
        <CardDescription>
          Потери и запас считаются по каждой частоте; график и геометрия — по
          основной
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        <FrequencyCompareTable rows={rows} />
      </CardContent>
    </Card>
  );
}
