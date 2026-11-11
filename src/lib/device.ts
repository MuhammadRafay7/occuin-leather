type DeviceHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

const LOW_MEMORY_GB = 4;
const LOW_CORES = 4;

export function isLowPowerDevice() {
  const hints = navigator as DeviceHints;
  if (hints.connection?.saveData) return true;
  if ((hints.deviceMemory ?? Infinity) <= LOW_MEMORY_GB) return true;
  if ((navigator.hardwareConcurrency || Infinity) <= LOW_CORES) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
