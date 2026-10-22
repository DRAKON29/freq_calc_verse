import {
  calculateLink,
  fsplDb,
  fresnelRadiusM,
  earthBulgeM,
} from "../../src/lib/propagation";

// FSPL: 868 MHz, 10 km → ожидаем ~111.2 дБ
const fspl = fsplDb(868, 10);
console.log("FSPL 868МГц/10км =", fspl.toFixed(2), "(ожидание ~111.22)");

// Зона Френеля: 10 км трасса, середина, 868 МГц → 17.32*sqrt(25/0.868) ≈ 92.9 м
const f1 = fresnelRadiusM(5, 5, 868);
console.log("F1 в середине 10км/868МГц =", f1.toFixed(1), "м (ожидание ~92.9)");

// Выпуклость Земли: 5+5 км, k=4/3 → 25/(12.742*1.333) ≈ 1.47 м
console.log("Bulge 5+5км k=4/3 =", earthBulgeM(5, 5, 4 / 3).toFixed(2), "м (~1.47)");

const baseConfig = {
  freqMHz: 868,
  txHeightM: 25,
  rxHeightM: 5,
  txPowerDbm: 20,
  txGainDbi: 2,
  rxGainDbi: 2,
  rxSensitivityDbm: -100,
  kFactor: 4 / 3,
};

// Плоская трасса 10 км
const flat = calculateLink(baseConfig, [
  { d: 0, h: 50 },
  { d: 10, h: 50 },
]);
if (!flat.ok) throw new Error("flat failed: " + flat.error);
console.log(
  "Плоская: RX =", flat.rxLevelDbm.toFixed(1), "дБм; запас =", flat.marginDb.toFixed(1),
  "дБ; LOS =", flat.losClear, "; дифракция =", flat.diffractionDb.toFixed(2)
);
// Ожидание RX = 24 - 111.22 = -87.2 дБм, запас +12.8

// Трасса с холмом 140 м в середине (LOS на 5 км ≈ 64 м) — препятствие ~76 м над лучом
const hill = calculateLink(baseConfig, [
  { d: 0, h: 50 },
  { d: 3.5, h: 58 },
  { d: 5, h: 140 },
  { d: 6.5, h: 60 },
  { d: 10, h: 48 },
]);
if (!hill.ok) throw new Error("hill failed: " + hill.error);
console.log(
  "Холм: дифракция =", hill.diffractionDb.toFixed(1), "дБ (ожидание ~24); препятствий =",
  hill.obstructionCount, "; RX =", hill.rxLevelDbm.toFixed(1), "дБм; LOS =", hill.losClear
);

// Граничный случай: препятствие точно на линии (h=0) → ровно 6 дБ
const graze = calculateLink(
  { ...baseConfig, txHeightM: 0, rxHeightM: 0, txPowerDbm: 0, txGainDbi: 0, rxGainDbi: 0, rxSensitivityDbm: -200, kFactor: 1e9 },
  [
    { d: 0, h: 0 },
    { d: 5, h: 100 },
    { d: 10, h: 0 },
  ]
);
if (!graze.ok) throw new Error("graze failed: " + graze.error);
console.log(
  "Касание (h=0): дифракция =", graze.diffractionDb.toFixed(2),
  "дБ (ожидание ~6.0); LOS =", graze.losClear
);

// Ошибки конфигурации перехватываются
const badFreq = calculateLink({ ...baseConfig, freqMHz: 0 }, [
  { d: 0, h: 0 },
  { d: 1, h: 0 },
]);
console.log("Ошибка при f=0 перехвачена:", !badFreq.ok);
const badProfile = calculateLink(baseConfig, [{ d: 5, h: 0 }]);
console.log("Ошибка при 1 точке перехвачена:", !badProfile.ok);
