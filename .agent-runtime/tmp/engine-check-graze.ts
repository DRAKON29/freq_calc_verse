import { calculateLink, fresnelRadiusM } from "../../src/lib/propagation";

// Проверка формулы Френеля из первых принципов: F1 = sqrt(λ·d1·d2/(d1+d2))
const lambda = 299_792_458 / (868e6);
const f1Direct = Math.sqrt((lambda * 5000 * 5000) / 10000);
console.log("F1 напрямую =", f1Direct.toFixed(1), "м; по формуле =", fresnelRadiusM(5, 5, 868).toFixed(1), "м");

// Настоящее касание: луч 50 м над плоской землёй 50 м, вершина 50 м посередине → h=0 → ~6 дБ
const graze = calculateLink(
  {
    freqMHz: 868,
    txHeightM: 0,
    rxHeightM: 0,
    txPowerDbm: 0,
    txGainDbi: 0,
    rxGainDbi: 0,
    rxSensitivityDbm: -200,
    kFactor: 1e9, // выключаем выпуклость Земли
  },
  [
    { d: 0, h: 50 },
    { d: 5, h: 50 },
    { d: 10, h: 50 },
  ]
);
if (!graze.ok) throw new Error("graze failed: " + graze.error);
console.log(
  "Касание (h=0): дифракция =", graze.diffractionDb.toFixed(2),
  "дБ (ожидание ~6.03); LOS =", graze.losClear
);

// Просвет ровно 60% F1 (93 м над лучом 50 м → h = ... ) — потери ~0 дБ
const clear60 = calculateLink(
  {
    freqMHz: 868,
    txHeightM: 0,
    rxHeightM: 0,
    txPowerDbm: 0,
    txGainDbi: 0,
    rxGainDbi: 0,
    rxSensitivityDbm: -200,
    kFactor: 1e9,
  },
  [
    { d: 0, h: 50 },
    { d: 5, h: 50 - 0.6 * f1Direct },
    { d: 10, h: 50 },
  ]
);
if (!clear60.ok) throw new Error("clear60 failed: " + clear60.error);
console.log(
  "Просвет 0.6·F1: дифракция =", clear60.diffractionDb.toFixed(2),
  "дБ (ожидание ~0); worstRatio =", clear60.worstRatio.toFixed(2)
);

// Промежуточный просвет 0.3·F1 → ν = −0.424 → J ≈ 2.5 дБ
const clear30 = calculateLink(
  {
    freqMHz: 868,
    txHeightM: 0,
    rxHeightM: 0,
    txPowerDbm: 0,
    txGainDbi: 0,
    rxGainDbi: 0,
    rxSensitivityDbm: -200,
    kFactor: 1e9,
  },
  [
    { d: 0, h: 50 },
    { d: 5, h: 50 - 0.3 * f1Direct },
    { d: 10, h: 50 },
  ]
);
if (!clear30.ok) throw new Error("clear30 failed: " + clear30.error);
console.log(
  "Просвет 0.3·F1: дифракция =", clear30.diffractionDb.toFixed(2),
  "дБ (ожидание ~2.5)"
);

// Два доминирующих препятствия — метод Эпштейна–Петерсона складывает потери
const two = calculateLink(
  {
    freqMHz: 868,
    txHeightM: 0,
    rxHeightM: 0,
    txPowerDbm: 0,
    txGainDbi: 0,
    rxGainDbi: 0,
    rxSensitivityDbm: -200,
    kFactor: 1e9,
  },
  [
    { d: 0, h: 0 },
    { d: 3, h: 60 },
    { d: 7, h: 60 },
    { d: 10, h: 0 },
  ]
);
if (!two.ok) throw new Error("two failed: " + two.error);
console.log(
  "Два препятствия: дифракция =", two.diffractionDb.toFixed(1),
  "дБ; препятствий =", two.obstructionCount
);
