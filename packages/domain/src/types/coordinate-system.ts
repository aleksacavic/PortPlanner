// CoordinateSystem matches `docs/coordinate-system.md`
// §"Implementation requirements" field-for-field (camelCase per TS
// convention; semantic 1:1 with the doc's snake_case fields).
//
// Transform methods (`toProjectLocal`, `toWGS84`,
// `projectLocalToMapPixel`, `mapPixelToProjectLocal`) are class
// behaviour, not document data; they arrive in M1.3 when the canvas
// uses them. M1.2 stores data only.

export interface CoordinateSystem {
  /** WGS84 latitude of project origin. */
  originLat: number;
  /** WGS84 longitude of project origin. */
  originLng: number;
  /** Degrees clockwise from grid north. */
  trueNorthRotation: number;
  /** UTM zone designator, e.g. "40N" for Abu Dhabi. */
  utmZone: string;
}
