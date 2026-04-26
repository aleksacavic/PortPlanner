// gripHitTest — screen-space hit-test against grip squares for the
// click-select grip-stretch flow (M1.3d Phase 6).
//
// Visual size: grip squares are 7-8 CSS px (paintSelection's
// GRIP_SIDE_CSS = 7, with a 1 px border). The hit-test tolerance
// is half the side: 4 CSS px. Using screen-space ensures the
// tolerance is constant across zoom — at zoom 100, a 4-px metric
// tolerance would be 0.04 m, useless (I-DTP-14).
//
// When multiple grips are within tolerance, the closest wins (squared-
// distance comparison; ordering is stable because grips have distinct
// positions in practice).

import type { Grip } from '../ui-state/store';
import { type ScreenPoint, type Viewport, metricToScreen } from './view-transform';

const DEFAULT_TOLERANCE_CSS = 4;

export function gripHitTest(
  screen: ScreenPoint,
  grips: Grip[],
  viewport: Viewport,
  toleranceCss = DEFAULT_TOLERANCE_CSS,
): Grip | null {
  let best: { grip: Grip; distSq: number } | null = null;
  const tolSq = toleranceCss * toleranceCss;
  for (const g of grips) {
    const s = metricToScreen(g.position, viewport);
    const dx = s.x - screen.x;
    const dy = s.y - screen.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > tolSq) continue;
    if (!best || distSq < best.distSq) best = { grip: g, distSq };
  }
  return best?.grip ?? null;
}
