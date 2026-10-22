/**
 * Эталонные проверки движка (временный скрипт, не входит в сборку).
 * Запуск: bun .agent-runtime/tmp/ref-check.ts
 */
import {
  calculateLink,
  earthBulgeM,
  fsplDb,
  fresnelRadiusM,
  type LinkConfig,
  type TerrainPoint,
} from "../../src/lib/propagation";

let failed = 0;
function check(name: string, got: number, want: number, tol: number) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failed++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${name}: получено ${got.toFixed(3)}, ожидалось ${want} ±${tol}`
  );
}

// 1. FSPL по ITU-R P.525
check("FSPL 868 МГц / 10 км, дБ", fsplDb(868, 10), 111.22, 0.01);

// 2. Первая зона Френеля в середине трассы
check("F1 середина 10 км / 868 МГц, м", fresnelRadiusM(5, 5, 868), 29.4, 0.1);

// 3. Выпуклость Земли
check("Выпуклость 5+5 км, k=4/3, м", earthBulgeM(5, 5, 4 / 3), 1.47, 0.01);

const flat: TerrainPoint[] = [
  { d: 0, h: 0 },
  { d: 5, h: 0 },
  { d: 10, h: 0 },
];
const baseCfg: LinkConfig = {
  freqMHz: 868,
  txHeightM: 0,
  rxHeightM: 0,
  txPowerDbm: 0,
  txGainDbi: 0,
  rxGainDbi: 0,
  rxSensitivityDbm: 0,
  kFactor: 4 / 3,
};
const bulge = earthBulgeM(5, 5, 4 / 3);
const f1 = fresnelRadiusM(5, 5, 868);

// 4. Касание луча с учётом выпуклости → ~6 дБ
const touch = calculateLink(
  { ...baseCfg, txHeightM: bulge, rxHeightM: bulge },
  flat
);
check("Касание луча → дифракция, дБ", touch.ok ? touch.diffractionDb : NaN, 6, 0.05);

// 5–6. Просвет 0.6·F1 → 0 дБ; 0.3·F1 → 2.53 дБ
const mk = (ratio: number) =>
  calculateLink(
    { ...baseCfg, txHeightM: bulge + ratio * f1, rxHeightM: bulge + ratio * f1 },
    flat
  );
const r06 = mk(0.6);
check("0.6·F1 → дифракция, дБ", r06.ok ? r06.diffractionDb : NaN, 0, 0.001);
const r03 = mk(0.3);
check("0.3·F1 → дифракция, дБ", r03.ok ? r03.diffractionDb : NaN, 2.53, 0.02);

// 7. Пресет «Два холма»: сравнение с независимым расчётом Эпштейна–Петерсона
const twoHills: TerrainPoint[] = [
  { d: 0, h: 60 },
  { d: 4, h: 85 },
  { d: 7, h: 200 },
  { d: 10, h: 75 },
  { d: 13, h: 180 },
  { d: 16, h: 80 },
  { d: 20, h: 62 },
];
const res2 = calculateLink({ ...baseCfg, txHeightM: 25, rxHeightM: 5 }, twoHills);

const dTot = 20;
const bulgeAt = (d: number) => earthBulgeM(d, dTot - d, 4 / 3);
const txAnt = 60 + 25;
const rxAnt = 62 + 5;
const eff7 = 200 + bulgeAt(7);
const eff13 = 180 + bulgeAt(13);
const lambda = 299792458 / (868e6);
const ke = (hM: number, d1Km: number, d2Km: number) => {
  const v =
    hM * Math.sqrt((2 * (d1Km + d2Km) * 1000) / (lambda * d1Km * 1000 * d2Km * 1000));
  if (v <= -0.78) return 0;
  const arg = Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1;
  return 6.9 + 20 * Math.log10(arg);
};
const line = (
  x1: number, y1: number, x2: number, y2: number, x: number
) => y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
const hObs7 = eff7 - line(0, txAnt, 13, eff13, 7);
const hObs13 = eff13 - line(7, eff7, 20, rxAnt, 13);
const epRef = ke(hObs7, 7, 6) + ke(hObs13, 6, 7);
console.log(
  `Независимый Э–П: вершина 7 км ${ke(hObs7, 7, 6).toFixed(2)} дБ + ` +
    `вершина 13 км ${ke(hObs13, 6, 7).toFixed(2)} дБ = ${epRef.toFixed(2)} дБ`
);
check("Два препятствия → дифракция, дБ", res2.ok ? res2.diffractionDb : NaN, epRef, 0.05);
check("Число препятствий", res2.ok ? res2.obstructionCount : NaN, 2, 0);
if (res2.ok) {
  console.log(
    `Движок: FSPL ${res2.fsplDb.toFixed(2)} + дифракция ${res2.diffractionDb.toFixed(2)}` +
      ` = ${res2.totalLossDb.toFixed(2)} дБ`
  );
}

if (failed > 0) {
  console.log(`\nПровалено проверок: ${failed}`);
  process.exit(1);
}
console.log("\nВсе эталонные проверки пройдены");
