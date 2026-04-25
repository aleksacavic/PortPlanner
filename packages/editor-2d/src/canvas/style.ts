// ByLayer effective-style resolution per ADR-017.

import type {
  ColorValue,
  DisplayOverrides,
  Layer,
  LineTypeId,
} from '@portplanner/domain';

export interface EffectiveStyle {
  color: ColorValue;
  lineType: LineTypeId;
  lineWeight: number;
}

export function effectiveColor(overrides: DisplayOverrides, layer: Layer): ColorValue {
  return overrides.color ?? layer.color;
}

export function effectiveLineType(overrides: DisplayOverrides, layer: Layer): LineTypeId {
  return overrides.lineType ?? layer.lineType;
}

export function effectiveLineWeight(overrides: DisplayOverrides, layer: Layer): number {
  return overrides.lineWeight ?? layer.lineWeight;
}

export function resolveEffectiveStyle(overrides: DisplayOverrides, layer: Layer): EffectiveStyle {
  return {
    color: effectiveColor(overrides, layer),
    lineType: effectiveLineType(overrides, layer),
    lineWeight: effectiveLineWeight(overrides, layer),
  };
}
