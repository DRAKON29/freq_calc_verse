/**
 * Подбор значений по умолчанию для карточки в СК-42 (временный скрипт).
 * Запуск: bun .agent-runtime/tmp/sk-defaults.ts
 */
import {
  gaussKrugerForward,
  krassovskyToWgs84,
  wgs84ToKrassovsky,
} from "../../src/lib/geo";

const a = wgs84ToKrassovsky({ lat: 55.7558, lon: 37.6173 });
const b = wgs84ToKrassovsky({ lat: 55.86, lon: 37.9 });
console.log("A (СК-42):", a);
console.log("B (СК-42):", b);
const zoneA = Math.floor(a.lon / 6) + 1;
const zoneB = Math.floor(b.lon / 6) + 1;
console.log("Зоны:", zoneA, zoneB);
console.log("A ГК:", gaussKrugerForward(a.lat, a.lon, zoneA));
console.log("B ГК:", gaussKrugerForward(b.lat, b.lon, zoneB));
console.log("Круг A:", krassovskyToWgs84(a));
console.log("Круг B:", krassovskyToWgs84(b));
