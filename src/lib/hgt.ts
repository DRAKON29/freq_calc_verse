/**
 * Чтение матриц высот SRTM (.hgt): сырые 16-битные big-endian отсчёты,
 * строки идут с северной кромки на юг, имя файла задаёт юго-западный угол
 * листа (например N47E039.hgt — 1°×1°).
 *
 * Профиль трассы строится точками вдоль ортодромии (см. lib/geo).
 */

import {
  geodesicInverse,
  sampleGeodesic,
  type LatLng,
} from "@/lib/geo";
import type { TerrainPoint } from "@/lib/propagation";

export interface HgtTile {
  name: string;
  /** Широта юго-западного угла, градусы */
  lat0: number;
  /** Долгота юго-западного угла, градусы */
  lon0: number;
  /** Отсчётов по стороне (3601 для SRTM-1, 1201 для SRTM-3) */
  size: number;
  /** Высоты, м; индекс row·size + col, row 0 — северная кромка */
  samples: Int16Array;
}

const VOID = -32768;
const HGT_NAME_RE = /^([NS])(\d{1,2})\s*([EW])(\d{1,3})\.hgt$/i;

export class HgtParseError extends Error {}

/** Разбор .hgt: имя файла + содержимое. Бросает HgtParseError. */
export function parseHgt(name: string, buffer: ArrayBuffer): HgtTile {
  const base = name.split(/[\\/]/).pop() ?? name;
  const m = HGT_NAME_RE.exec(base.trim());
  if (!m) {
    throw new HgtParseError(
      `«${base}»: имя должно задавать юго-западный угол листа, например N47E039.hgt.`
    );
  }
  const lat0 = (m[1].toUpperCase() === "S" ? -1 : 1) * Number.parseInt(m[2], 10);
  const lon0 = (m[3].toUpperCase() === "W" ? -1 : 1) * Number.parseInt(m[4], 10);

  const bytes = buffer.byteLength;
  const side = Math.sqrt(bytes / 2);
  const size = Math.round(side);
  if (size < 2 || Math.abs(side - size) > 1e-6 || bytes % 2 !== 0) {
    throw new HgtParseError(
      `«${base}»: размер ${bytes} байт не соответствует квадратной матрице высот.`
    );
  }

  const samples = new Int16Array(size * size);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, false);
  }
  return { name: base, lat0, lon0, size, samples };
}

function rawAt(tile: HgtTile, row: number, col: number): number | null {
  if (row < 0 || col < 0 || row >= tile.size || col >= tile.size) return null;
  const v = tile.samples[row * tile.size + col];
  return v === VOID ? null : v;
}

/** Билинейная интерполяция с учётом пустот (-32768). */
function sampleBilinear(tile: HgtTile, rowF: number, colF: number): number | null {
  const r0 = Math.min(Math.floor(rowF), tile.size - 2);
  const c0 = Math.min(Math.floor(colF), tile.size - 2);
  const dr = Math.min(Math.max(rowF - r0, 0), 1);
  const dc = Math.min(Math.max(colF - c0, 0), 1);
  const corners: Array<[number | null, number]> = [
    [rawAt(tile, r0, c0), (1 - dr) * (1 - dc)],
    [rawAt(tile, r0, c0 + 1), (1 - dr) * dc],
    [rawAt(tile, r0 + 1, c0), dr * (1 - dc)],
    [rawAt(tile, r0 + 1, c0 + 1), dr * dc],
  ];
  let sum = 0;
  let wsum = 0;
  for (const [v, w] of corners) {
    if (v === null) continue;
    sum += v * w;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : null;
}

/** Высота в точке по набору листов; null — точка вне данных или пустота. */
export function hgtElevationAt(
  tiles: HgtTile[],
  lat: number,
  lon: number
): number | null {
  for (const tile of tiles) {
    const step = 1 / (tile.size - 1);
    const fiLat = (lat - tile.lat0) / step;
    const fiLon = (lon - tile.lon0) / step;
    if (
      fiLat < -0.5 ||
      fiLon < -0.5 ||
      fiLat > tile.size - 0.5 ||
      fiLon > tile.size - 0.5
    ) {
      continue;
    }
    const value = sampleBilinear(tile, tile.size - 1 - fiLat, fiLon);
    if (value !== null) return value;
  }
  return null;
}

export interface HgtProfileResult {
  /** Профиль от ПД (d = 0) к ПР, км/м */
  points: TerrainPoint[];
  /** Длина трассы, км */
  distanceKm: number;
  /** Азимут трассы (из точки ПД), градусы */
  azimuthDeg: number;
  /** Доля точек, где данных не было (заполнены интерполяцией), 0…1 */
  missingRatio: number;
}

/**
 * Профиль по ортодромии A→B из матриц SRTM.
 * Бросает HgtParseError, если точки совпадают или данные не покрывают трассу.
 */
export function profileFromHgt(
  tiles: HgtTile[],
  from: LatLng,
  to: LatLng,
  minSamples = 100,
  maxSamples = 800
): HgtProfileResult {
  const inv = geodesicInverse(from, to);
  if (!inv) {
    throw new HgtParseError("Координаты точек A и B заданы некорректно.");
  }
  if (inv.distanceM < 1) {
    throw new HgtParseError("Точки A и B совпадают — укажите разные точки.");
  }

  const segments = Math.round(
    Math.min(maxSamples, Math.max(minSamples, inv.distanceM / 25))
  );
  const coords = sampleGeodesic(from, to, segments);

  const elevations: Array<number | null> = coords.map((p) =>
    hgtElevationAt(tiles, p.lat, p.lon)
  );

  // Заполнение пустот: интерполяция внутри трассы, nearest — на концах
  const firstValid = elevations.findIndex((v) => v !== null);
  const lastValid = elevations.findLastIndex((v) => v !== null);
  if (firstValid < 0) {
    throw new HgtParseError(
      "Загруженные листы не покрывают трассу A–B — проверьте координаты."
    );
  }
  let missing = 0;
  for (let i = 0; i < elevations.length; i++) {
    if (elevations[i] !== null) continue;
    missing++;
    if (i < firstValid) {
      elevations[i] = elevations[firstValid];
      continue;
    }
    if (i > lastValid) {
      elevations[i] = elevations[lastValid];
      continue;
    }
    let prev = i - 1;
    while (prev > firstValid && elevations[prev] === null) prev--;
    let next = i + 1;
    while (next < lastValid && elevations[next] === null) next++;
    const a = elevations[prev] as number;
    const b = elevations[next] as number;
    const t = (i - prev) / (next - prev);
    elevations[i] = a + (b - a) * t;
  }

  const distanceKm = inv.distanceM / 1000;
  const points: TerrainPoint[] = elevations.map((h, i) => ({
    d: (distanceKm * i) / segments,
    h: Math.round((h as number) * 10) / 10,
  }));

  return {
    points,
    distanceKm,
    azimuthDeg: inv.azFwdDeg,
    missingRatio: missing / elevations.length,
  };
}
