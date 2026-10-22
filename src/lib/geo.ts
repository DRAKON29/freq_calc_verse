/**
 * Геодезические расчёты для загрузки рельефа по координатам:
 *  - ортодромия на эллипсоиде WGS-84 (формулы Винсенти, прямая и обратная задачи);
 *  - проекция Гаусса–Крюгера на эллипсоиде Красовского (матрицы высот ГИС «Панорама»);
 *  - сдвиг датума Молоденского Пулково-1942 ↔ WGS-84 (ГОСТ Р 51794-2008).
 *
 * Все чистые функции, детерминированные — SSR-совместимы.
 */

export interface LatLng {
  /** Широта, градусы */
  lat: number;
  /** Долгота, градусы */
  lon: number;
}

export interface GeodesicSolution {
  /** Длина геодезической линии, м */
  distanceM: number;
  /** Прямой азимут (из первой точки), градусы [0; 360) */
  azFwdDeg: number;
  /** Обратный азимут (из второй точки), градусы [0; 360) */
  azBackDeg: number;
}

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Эллипсоид WGS-84 */
export const WGS84 = { a: 6378137, f: 1 / 298.257223563 } as const;
/** Эллипсоид Красовского (Пулково-1942) */
export const KRASSOVSKY = { a: 6378245, f: 1 / 298.3 } as const;

interface Ellipsoid {
  a: number;
  f: number;
}

/**
 * Вектор переноса Молоденского Пулково-1942 → WGS-84, м
 * (ΔX = 23,92; ΔY = −141,27; ΔZ = −80,9, ГОСТ Р 51794-2008).
 */
const PULKOVO_TO_WGS84 = { dx: 23.92, dy: -141.27, dz: -80.9 } as const;

function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function normalizeLon180(deg: number): number {
  return ((deg + 540) % 360) - 180;
}

/** Обратная геодезическая задача (Винсенти). null — вход вне диапазона. */
export function geodesicInverse(p1: LatLng, p2: LatLng): GeodesicSolution | null {
  if (!finiteCoords(p1) || !finiteCoords(p2)) return null;
  const { a, f } = WGS84;
  const b = a * (1 - f);

  const phi1 = p1.lat * D2R;
  const phi2 = p2.lat * D2R;
  const L = (p2.lon - p1.lon) * D2R;

  const U1 = Math.atan((1 - f) * Math.tan(phi1));
  const U2 = Math.atan((1 - f) * Math.tan(phi2));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let sinLambda = Math.sin(lambda);
  let cosLambda = Math.cos(lambda);
  let sinSigma = 0;
  let cosSigma = 1;
  let sigma = 0;
  let cosSqAlpha = 1;
  let cos2SigmaM = 1;

  for (let i = 0; i < 200; i++) {
    sinLambda = Math.sin(lambda);
    cosLambda = Math.cos(lambda);
    sinSigma = Math.hypot(
      cosU2 * sinLambda,
      cosU1 * sinU2 - sinU1 * cosU2 * cosLambda
    );
    if (sinSigma === 0) {
      // Совпадающие точки
      return { distanceM: 0, azFwdDeg: 0, azBackDeg: 0 };
    }
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM =
      cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;
    const C =
      (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    const prev = lambda;
    lambda =
      L +
      (1 - C) *
        f *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    if (Math.abs(lambda - prev) < 1e-12) break;
  }

  const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
          (B / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma ** 2) *
            (-3 + 4 * cos2SigmaM ** 2)));
  const distanceM = b * A * (sigma - deltaSigma);

  const azFwd = Math.atan2(
    cosU2 * sinLambda,
    cosU1 * sinU2 - sinU1 * cosU2 * cosLambda
  );
  const azBack = Math.atan2(
    cosU1 * sinLambda,
    -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda
  );

  return {
    distanceM,
    azFwdDeg: normalizeBearing(azFwd * R2D),
    azBackDeg: normalizeBearing(azBack * R2D),
  };
}

/** Прямая геодезическая задача (Винсенти): точка на расстоянии distM по азимуту azDeg. */
export function geodesicDirect(
  p1: LatLng,
  azDeg: number,
  distM: number
): LatLng {
  if (!finiteCoords(p1) || !Number.isFinite(azDeg) || !Number.isFinite(distM)) {
    return { ...p1 };
  }
  if (distM <= 0) return { ...p1 };

  const { a, f } = WGS84;
  const b = a * (1 - f);
  const alpha1 = azDeg * D2R;

  const U1 = Math.atan((1 - f) * Math.tan(p1.lat * D2R));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sigma1 = Math.atan2(Math.tan(U1), Math.cos(alpha1));
  const sinAlpha = cosU1 * Math.sin(alpha1);
  const cosSqAlpha = 1 - sinAlpha * sinAlpha;
  const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

  let sigma = distM / (b * A);
  let sigmaPrev = 2 * Math.PI;
  let sinSigma = Math.sin(sigma);
  let cosSigma = Math.cos(sigma);
  let cos2SigmaM = Math.cos(2 * sigma1 + sigma);

  for (let i = 0; i < 200 && Math.abs(sigma - sigmaPrev) > 1e-12; i++) {
    cos2SigmaM = Math.cos(2 * sigma1 + sigma);
    sinSigma = Math.sin(sigma);
    cosSigma = Math.cos(sigma);
    const deltaSigma =
      B *
      sinSigma *
      (cos2SigmaM +
        (B / 4) *
          (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
            (B / 6) *
              cos2SigmaM *
              (-3 + 4 * sinSigma ** 2) *
              (-3 + 4 * cos2SigmaM ** 2)));
    sigmaPrev = sigma;
    sigma = distM / (b * A) + deltaSigma;
  }

  const sinSigmaCosAlpha1 = sinSigma * Math.cos(alpha1);
  const phi2 = Math.atan2(
    sinU1 * cosSigma + cosU1 * sinSigmaCosAlpha1,
    (1 - f) * Math.hypot(sinAlpha, sinU1 * sinSigma - cosU1 * sinSigmaCosAlpha1)
  );
  const lambda = Math.atan2(
    sinSigma * Math.sin(alpha1),
    cosU1 * cosSigma - sinU1 * sinSigmaCosAlpha1
  );
  const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
  const L =
    lambda -
    (1 - C) *
      f *
      sinAlpha *
      (sigma +
        C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));

  return { lat: phi2 * R2D, lon: normalizeLon180((p1.lon + L * R2D)) };
}

/**
 * Точки вдоль ортодромии, включая оба конца.
 * segments — число отрезков (≥ 1), результат содержит segments + 1 точек.
 */
export function sampleGeodesic(
  from: LatLng,
  to: LatLng,
  segments: number
): LatLng[] {
  const inv = geodesicInverse(from, to);
  if (!inv) return [];
  const n = Math.max(1, Math.floor(segments));
  const points: LatLng[] = [{ ...from }];
  const step = inv.distanceM / n;
  for (let i = 1; i < n; i++) {
    points.push(geodesicDirect(from, inv.azFwdDeg, step * i));
  }
  points.push({ ...to });
  return points;
}

/* ------------------------------------------------------------------ */
/* Гаусс–Крюгер на эллипсоиде Красовского                              */
/* ------------------------------------------------------------------ */

/**
 * Проекция Гаусса–Крюгера: геодезические координаты → плоские, м.
 * zone — номер зоны (1…60), осевой меридиан 6·zone − 3°.
 * Возвращает северное x и восточное y (с номером зоны в старших разрядах
 * и сдвигом 500 км, как в топографических картах РФ).
 */
export function gaussKrugerForward(
  latDeg: number,
  lonDeg: number,
  zone: number
): { x: number; y: number } {
  const { a, f } = KRASSOVSKY;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);

  const B = latDeg * D2R;
  const l = (lonDeg - (6 * zone - 3)) * D2R;

  const sinB = Math.sin(B);
  const cosB = Math.cos(B);
  const tanB = Math.tan(B);
  const cos2B = cosB * cosB;
  const eta2 = ep2 * cos2B;
  const t2 = tanB * tanB;

  const N = a / Math.sqrt(1 - e2 * sinB * sinB);
  const X = meridianArcKrasovsky(B);

  const l2 = l * l;
  const l4 = l2 * l2;
  const l6 = l4 * l2;
  const cos4B = cos2B * cos2B;
  const cos6B = cos4B * cos2B;

  const x =
    X +
    (N / 2) * tanB * cos2B * l2 +
    (N / 24) * tanB * cos4B * (5 - t2 + 9 * eta2 + 4 * eta2 * eta2) * l4 +
    (N / 720) * tanB * cos6B * (61 - 58 * t2 + t2 * t2) * l6;
  const y =
    N * cosB * l +
    (N / 6) * cos2B * cosB * (1 - t2 + eta2) * l2 * l +
    (N / 120) * cos4B * cosB * (5 - 18 * t2 + t2 * t2 + 14 * eta2 - 58 * eta2 * t2) * l4 * l;

  return { x, y: zone * 1e6 + 500_000 + y };
}

/** Обратное преобразование Гаусса–Крюгера (Красовский): плоские, м → градусы. */
export function gaussKrugerInverse(
  x: number,
  y: number
): { latDeg: number; lonDeg: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const { a, f } = KRASSOVSKY;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);

  const zone = Math.floor(y / 1e6);
  if (!Number.isInteger(zone) || zone < 1 || zone > 60) return null;
  const yy = y - zone * 1e6 - 500_000; // восточное от осевого меридиана, м

  const Bf = footpointLatitude(x);
  if (Bf === null) return null;

  const sinBf = Math.sin(Bf);
  const cosBf = Math.cos(Bf);
  const tanBf = Math.tan(Bf);
  const tf = tanBf * tanBf;
  const eta2f = (ep2 * cosBf * cosBf);
  const sin2Bf = sinBf * sinBf;
  const Mf = (a * (1 - e2)) / (1 - e2 * sin2Bf) ** 1.5;
  const Nf = a / Math.sqrt(1 - e2 * sin2Bf);

  const yy2 = yy * yy;
  const yy4 = yy2 * yy2;
  const yy6 = yy4 * yy2;

  const B =
    Bf -
    (tf * yy2) / (2 * Mf * Nf) +
    ((tf * (5 + 3 * tf + eta2f - 9 * eta2f * tf)) / (24 * Mf * Nf ** 3)) * yy4 -
    ((tf * (61 + 90 * tf + 45 * tf * tf)) / (720 * Mf * Nf ** 5)) * yy6;
  const l =
    yy / (Nf * cosBf) -
    ((1 + 2 * tf + eta2f) / (6 * Nf ** 3 * cosBf)) * yy2 * yy +
    ((5 + 28 * tf + 24 * tf * tf + 6 * eta2f + 8 * eta2f * tf) /
      (120 * Nf ** 5 * cosBf)) *
      yy4 *
      yy;

  return {
    latDeg: B * R2D,
    lonDeg: (6 * zone - 3) + l * R2D,
  };
}

/** Номер зоны Гаусса–Крюгера по долготе (6-градусные зоны от Гринвича). */
export function gkZoneFromLon(lonDeg: number): number {
  return Math.min(60, Math.max(1, Math.floor(lonDeg / 6) + 1));
}

/** Длина дуги меридиана от экватора (Красовский), ряд по гармоникам, м. */
function meridianArcKrasovsky(B: number): number {
  const { a, f } = KRASSOVSKY;
  const e2 = f * (2 - f);
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const A0 = 1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256;
  const A2 = (3 / 8) * (e2 + (e4 / 4) + (15 * e6) / 128);
  const A4 = (15 / 256) * (e4 + (3 * e6) / 4);
  const A6 = (35 * e6) / 3072;
  return (
    a *
    (A0 * B -
      A2 * Math.sin(2 * B) +
      A4 * Math.sin(4 * B) -
      A6 * Math.sin(6 * B))
  );
}

/** Широта по длине дуги меридиана (Ньютон по производной ряда), рад. */
function footpointLatitude(x: number): number | null {
  if (!Number.isFinite(x)) return null;
  const { a, f } = KRASSOVSKY;
  const e2 = f * (2 - f);
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const A0 = 1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256;
  const A2 = (3 / 8) * (e2 + (e4 / 4) + (15 * e6) / 128);
  const A4 = (15 / 256) * (e4 + (3 * e6) / 4);
  const A6 = (35 * e6) / 3072;

  let B = x / (a * A0);
  for (let i = 0; i < 50; i++) {
    const s2 = Math.sin(2 * B);
    const s4 = Math.sin(4 * B);
    const s6 = Math.sin(6 * B);
    const fx = a * (A0 * B - A2 * s2 + A4 * s4 - A6 * s6) - x;
    const dfx = a * (A0 - 2 * A2 * Math.cos(2 * B) + 4 * A4 * Math.cos(4 * B) - 6 * A6 * Math.cos(6 * B));
    if (dfx === 0) return null;
    const dB = fx / dfx;
    B -= dB;
    if (Math.abs(dB) < 1e-14) break;
  }
  return B;
}

/* ------------------------------------------------------------------ */
/* Сдвиг датума Молоденского: Пулково-1942 ↔ WGS-84                    */
/* ------------------------------------------------------------------ */

function geodeticToEcef(p: LatLng, ell: Ellipsoid): [number, number, number] {
  const { a, f } = ell;
  const e2 = f * (2 - f);
  const B = p.lat * D2R;
  const L = p.lon * D2R;
  const sinB = Math.sin(B);
  const cosB = Math.cos(B);
  const N = a / Math.sqrt(1 - e2 * sinB * sinB);
  const h = 0; // высотой над эллипсоидом пренебрегаем (вклад < 0,0001" в плане)
  return [
    (N + h) * cosB * Math.cos(L),
    (N + h) * cosB * Math.sin(L),
    (N * (1 - e2) + h) * sinB,
  ];
}

function ecefToGeodetic(v: [number, number, number], ell: Ellipsoid): LatLng {
  const { a, f } = ell;
  const e2 = f * (2 - f);
  const [x, y, z] = v;
  const L = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  // Метод Боуринга
  const b = a * (1 - f);
  const ep2 = (a * a - b * b) / (b * b);
  const theta = Math.atan2(z * a, p * b);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const B = Math.atan2(
    z + ep2 * b * sinTheta ** 3,
    p - e2 * a * cosTheta ** 3
  );
  return { lat: B * R2D, lon: L * R2D };
}

/** Пулково-1942 (Красовский) → WGS-84 */
export function krassovskyToWgs84(p: LatLng): LatLng {
  const [x, y, z] = geodeticToEcef(p, KRASSOVSKY);
  return ecefToGeodetic(
    [x + PULKOVO_TO_WGS84.dx, y + PULKOVO_TO_WGS84.dy, z + PULKOVO_TO_WGS84.dz],
    WGS84
  );
}

/** WGS-84 → Пулково-1942 (Красовский) */
export function wgs84ToKrassovsky(p: LatLng): LatLng {
  const [x, y, z] = geodeticToEcef(p, WGS84);
  return ecefToGeodetic(
    [x - PULKOVO_TO_WGS84.dx, y - PULKOVO_TO_WGS84.dy, z - PULKOVO_TO_WGS84.dz],
    KRASSOVSKY
  );
}

function finiteCoords(p: LatLng): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lon) <= 180
  );
}
