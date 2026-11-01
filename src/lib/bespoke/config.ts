export const DEPOSIT_PERCENT = 50;
export const SEAM_ALLOWANCE_MM = 6;
export const HIDE_WASTAGE = 1.35;

export const RULES = {
  minPieceWidthMm: 12,
  minHandleWidthMm: 10,
  handleWidthPerLitre: 1.4,
  strapWidthPerBagMetre: 45,
  minCornerDegrees: 35,
  stitchedMinPieceMm: 14,
  unsupportedSpanMm: 420,
  maxHideAreaDm2: 180,
  maxPieceAreaDm2: 90,
  bagTypesWithStraps: ["bag", "laptop_bag"],
  strapMinLengthMm: 500,
  tooNarrowToCutMm: 6,
  minStitchCoverage: 0.85,
  minCornerRadiusMm: 5,
  tooTightCornerRadiusMm: 2,
  unsupportedOverhangMm: 120,
  touchToleranceMm: 1,
  looseGapBlockerMm: 40,
  hardwareOffLeatherToleranceMm: 2,
  warnHideAreaDm2: 120,
} as const;

export const PATTERN = {
  tubeWrap: 2.4,
  threadPerStitchedMm: 4,
  squareFeetPerDm2: 1 / 9.2903,
  cornerTurnDegrees: 60,
  gussetSplitDegrees: 50,
  openingNormalDegrees: 45,
  handleReachMm: 60,
  notchInsideMm: 3,
  grainArrowMaxMm: 120,
  sheet: { widthMm: 210, heightMm: 297, marginMm: 10, headerMm: 18, footerMm: 14, gapMm: 8, labelMm: 12, overlapMm: 12, checkSquareMm: 100 },
  maxSeamAllowanceMm: 20,
} as const;
