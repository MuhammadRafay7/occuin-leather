export const critical = (stiffness: number, mass = 1) => ({
  type: "spring" as const,
  stiffness,
  mass,
  damping: 2 * Math.sqrt(stiffness * mass),
});

export const SHEET_SPRING = critical(380);
export const TRACK_SPRING = critical(620);
export const INSTANT = { duration: 0 };
