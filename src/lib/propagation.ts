/**
 * Расчёт радиотрассы: потери в свободном пространстве (ITU-R P.525),
 * дифракция на препятствиях рельефа (ITU-R P.526, метод Эпштейна–Петерсона),
 * поправка на кривизну Земли через фактор рефракции k, зоны Френеля.
 *
 * Все чистые функции, детерминированные — SSR-совместимы.
 */

export interface TerrainPoint {
  /** Расстояние от передатчика, км */
  d: number;
  /** Высота рельефа над уровнем моря, м */
  h: number;
}

export interface LinkConfig {
  freqMHz: number;
  /** Высота антенны передатчика над рельефом, м */
  txHeightM: number;
  /** Высота антенны приёмника над рельефом, м */
  rxHeightM: number;
  txPowerDbm: number;
  txGainDbi: number;
  rxGainDbi: number;
  rxSensitivityDbm: number;
  /** Фактор рефракции атмосферы (4/3 — стандартная) */
  kFactor: number;
}

export interface ProfileSample {
  /** Расстояние от передатчика, км */
  d: number;
  /** Рельеф (без учёта кривизны), м */
  terrain: number;
  /** Рельеф с учётом выпуклости Земли, м */
  terrainEff: number;
  /** Высота луча визирования, м */
  los: number;
  /** Просвет: луч минус рельеф с учётом рефракции, м */
  clearance: number;
  /** Радиус первой зоны Френеля, м */
  fresnel: number;
  /** Нижняя граница первой зоны Френеля, м */
  fresnelLow: number;
  /** Верхняя граница первой зоны Френеля, м */
  fresnelHigh: number;
  /** Отношение просвета к радиусу F1 */
  ratio: number;
}

export interface PropagationOk {
  ok: true;
  distanceKm: number;
  wavelengthM: number;
  fsplDb: number;
  diffractionDb: number;
  totalLossDb: number;
  eirpDbm: number;
  rxLevelDbm: number;
  marginDb: number;
  /** Прямая видимость есть (просвет > 0 по всей трассе) */
  losClear: boolean;
  minClearanceM: number;
  minClearanceAtKm: number;
  /** Минимальное отношение просвет/F1 по трассе */
  worstRatio: number;
  worstRatioAtKm: number;
  fresnelAtWorstM: number;
  /** Число вершин рельефа выше луча визирования */
  obstructionCount: number;
  txGroundM: number;
  rxGroundM: number;
  txAntM: number;
  rxAntM: number;
  samples: ProfileSample[];
}

export type PropagationResult =
  | PropagationOk
  | { ok: false; error: string };

const SPEED_OF_LIGHT = 299_792_458;
const EARTH_RADIUS_KM = 6371;
/** 1000 / (2 * R_земли) — коэффициент выпуклости Земли, d1*d2/(12.742*k) метров */
const BULGE_COEFF = 1000 / (2 * EARTH_RADIUS_KM);

export function wavelengthM(freqMHz: number): number {
  return SPEED_OF_LIGHT / (freqMHz * 1e6);
}

/** Потери в свободном пространстве, дБ */
export function fsplDb(freqMHz: number, distKm: number): number {
  return 32.45 + 20 * Math.log10(freqMHz) + 20 * Math.log10(distKm);
}

/** Радиус первой зоны Френеля, м (d1, d2, D — км, f — МГц) */
export function fresnelRadiusM(d1Km: number, d2Km: number, freqMHz: number): number {
  const fGHz = freqMHz / 1000;
  const total = d1Km + d2Km;
  if (fGHz <= 0 || total <= 0 || d1Km < 0 || d2Km < 0) return 0;
  return 17.32 * Math.sqrt((d1Km * d2Km) / (fGHz * total));
}

/** Выпуклость Земли между точками, м (d1, d2 — км) */
export function earthBulgeM(d1Km: number, d2Km: number, kFactor: number): number {
  const k = Math.max(kFactor, 0.1);
  return BULGE_COEFF * (d1Km * d2Km) / k;
}

/** Дифракционные потери на одном клиновидном препятствии, дБ (ITU-R P.526) */
function knifeEdgeLossDb(v: number): number {
  if (v <= -0.78) return 0;
  const arg = Math.sqrt((v - 0.1) * (v - 0.1) + 1) + v - 0.1;
  return 6.9 + 20 * Math.log10(arg);
}

/** v-параметр Френеля для препятствия высотой hM над линией */
function fresnelKirchhoffV(hM: number, d1Km: number, d2Km: number, lambda: number): number {
  const d1 = d1Km * 1000;
  const d2 = d2Km * 1000;
  if (d1 <= 0 || d2 <= 0 || lambda <= 0) return -Infinity;
  return hM * Math.sqrt((2 * (d1 + d2)) / (lambda * d1 * d2));
}

interface Vertex {
  d: number;
  h: number;
  terrainEff: number;
  clearance: number;
}

/** Сортировка, нормализация и дедупликация профиля */
function sanitizeProfile(points: TerrainPoint[]): TerrainPoint[] {
  const valid = points.filter(
    (p) => Number.isFinite(p.d) && Number.isFinite(p.h)
  );
  if (valid.length < 2) return [];
  const sorted = [...valid].sort((a, b) => a.d - b.d);
  sorted[0] = { ...sorted[0], d: 0 };
  const out: TerrainPoint[] = [];
  for (const p of sorted) {
    const d = Math.min(p.d, sorted[sorted.length - 1].d);
    if (out.length > 0 && d - out[out.length - 1].d < 1e-6) {
      if (p.h > out[out.length - 1].h) out[out.length - 1] = { d, h: p.h };
      continue;
    }
    out.push({ d, h: p.h });
  }
  if (out.length < 2 || out[out.length - 1].d <= 0) return [];
  return out;
}

function terrainAt(points: TerrainPoint[], d: number): number {
  if (d <= points[0].d) return points[0].h;
  const last = points[points.length - 1];
  if (d >= last.d) return last.h;
  let i = 1;
  while (i < points.length && points[i].d < d) i++;
  const a = points[i - 1];
  const b = points[i];
  const t = (d - a.d) / (b.d - a.d);
  return a.h + (b.h - a.h) * t;
}

export function calculateLink(
  config: LinkConfig,
  profile: TerrainPoint[]
): PropagationResult {
  if (!Number.isFinite(config.freqMHz) || config.freqMHz <= 0) {
    return { ok: false, error: "Укажите частоту больше 0 МГц." };
  }
  const points = sanitizeProfile(profile);
  if (points.length < 2) {
    return {
      ok: false,
      error: "Профиль рельефа должен содержать минимум две точки на разных расстояниях.",
    };
  }
  const distanceKm = points[points.length - 1].d;

  const txHeight = Number.isFinite(config.txHeightM) ? Math.max(0, config.txHeightM) : 0;
  const rxHeight = Number.isFinite(config.rxHeightM) ? Math.max(0, config.rxHeightM) : 0;
  const kFactor = Number.isFinite(config.kFactor) ? config.kFactor : 4 / 3;

  const txGroundM = points[0].h;
  const rxGroundM = points[points.length - 1].h;
  const txAntM = txGroundM + txHeight;
  const rxAntM = rxGroundM + rxHeight;
  const lambda = wavelengthM(config.freqMHz);

  const losAt = (d: number) => txAntM + ((rxAntM - txAntM) * d) / distanceKm;
  const bulgeAt = (d: number) => earthBulgeM(d, distanceKm - d, kFactor);

  // Вершины профиля и их просвет относительно луча (с учётом рефракции)
  const vertices: Vertex[] = points.slice(1, -1).map((p) => {
    const terrainEff = p.h + bulgeAt(p.d);
    return { d: p.d, h: p.h, terrainEff, clearance: losAt(p.d) - terrainEff };
  });

  const blocked = vertices.filter((v) => v.clearance < 0);

  let diffractionDb = 0;
  let obstructionCount = 0;

  if (blocked.length > 0) {
    // Доминирующие препятствия: вершины ниже луча, являющиеся локальными
    // минимумами просвета. Для плотного профиля (матрицы высот) отбрасывает
    // склоны, оставляя гребни, — иначе один холм посчитался бы десятком клиньев.
    const dominant: Vertex[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      if (v.clearance >= 0) continue;
      const prevC = i > 0 ? vertices[i - 1].clearance : Infinity;
      const nextC = i < vertices.length - 1 ? vertices[i + 1].clearance : Infinity;
      if (v.clearance <= prevC && v.clearance <= nextC) dominant.push(v);
    }

    // Метод Эпштейна–Петерсона: каждое препятствие — клин между
    // соседними доминирующими препятствиями (или терминалами).
    obstructionCount = dominant.length;
    const anchors = [
      { d: 0, h: txAntM },
      ...dominant.map((v) => ({ d: v.d, h: v.terrainEff })),
      { d: distanceKm, h: rxAntM },
    ];
    for (let i = 1; i < anchors.length - 1; i++) {
      const prev = anchors[i - 1];
      const next = anchors[i + 1];
      const edge = anchors[i];
      const lineH =
        prev.h + ((next.h - prev.h) * (edge.d - prev.d)) / (next.d - prev.d);
      const hObs = edge.h - lineH;
      if (hObs <= 0) continue;
      diffractionDb += knifeEdgeLossDb(
        fresnelKirchhoffV(hObs, edge.d - prev.d, next.d - edge.d, lambda)
      );
    }
    if (diffractionDb <= 0) {
      // Препятствия есть, но метод Э–П дал ноль (не выше локальных линий) —
      // считаем доминирующую вершину одним клином до терминалов.
      const dominant = blocked.reduce((a, b) => (a.clearance <= b.clearance ? a : b));
      diffractionDb = knifeEdgeLossDb(
        fresnelKirchhoffV(
          losAt(dominant.d) - dominant.terrainEff,
          dominant.d,
          distanceKm - dominant.d,
          lambda
        )
      );
    }
  } else {
    // Трасса чистая: недостаточный просвет над худшей вершиной даёт до ~6 дБ
    // на касании (v = −√2·просвет/F₁; просвет ≥ 0,55·F₁ → 0 дБ)
    if (vertices.length > 0) {
      const worst = vertices.reduce((a, b) => (a.clearance <= b.clearance ? a : b));
      diffractionDb = knifeEdgeLossDb(
        fresnelKirchhoffV(-worst.clearance, worst.d, distanceKm - worst.d, lambda)
      );
    }
  }

  const freeSpaceLoss = fsplDb(config.freqMHz, distanceKm);
  const totalLossDb = freeSpaceLoss + Math.max(0, diffractionDb);

  const eirpDbm = config.txPowerDbm + config.txGainDbi;
  const rxLevelDbm = eirpDbm + config.rxGainDbi - totalLossDb;
  const marginDb = rxLevelDbm - config.rxSensitivityDbm;

  // Непрерывный срез трассы для графика
  const N = 320;
  const samples: ProfileSample[] = [];
  for (let i = 0; i <= N; i++) {
    const d = (distanceKm * i) / N;
    const terrain = terrainAt(points, d);
    const terrainEff = terrain + bulgeAt(d);
    const los = losAt(d);
    const fresnel = fresnelRadiusM(d, distanceKm - d, config.freqMHz);
    const clearance = los - terrainEff;
    samples.push({
      d,
      terrain,
      terrainEff,
      los,
      clearance,
      fresnel,
      fresnelLow: los - fresnel,
      fresnelHigh: los + fresnel,
      ratio: fresnel > 0.01 ? clearance / fresnel : Infinity,
    });
  }

  const interior = samples.filter((s) => s.d > 0 && s.d < distanceKm);
  const worstClearance = interior.reduce((a, b) => (a.clearance <= b.clearance ? a : b));
  const worstRatioSample = interior.reduce((a, b) => (a.ratio <= b.ratio ? a : b));

  return {
    ok: true,
    distanceKm,
    wavelengthM: lambda,
    fsplDb: freeSpaceLoss,
    diffractionDb: Math.max(0, diffractionDb),
    totalLossDb,
    eirpDbm,
    rxLevelDbm,
    marginDb,
    losClear: worstClearance.clearance > 0.01,
    minClearanceM: worstClearance.clearance,
    minClearanceAtKm: worstClearance.d,
    worstRatio: worstRatioSample.ratio,
    worstRatioAtKm: worstRatioSample.d,
    fresnelAtWorstM: worstRatioSample.fresnel,
    obstructionCount,
    txGroundM,
    rxGroundM,
    txAntM,
    rxAntM,
    samples,
  };
}
