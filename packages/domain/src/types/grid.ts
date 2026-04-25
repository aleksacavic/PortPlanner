// Grid entity per ADR-016. First-class persisted drafting aid.
// Origin / angle / X+Y spacings define the lattice; `activeForSnap`
// controls whether the snap engine treats it as a candidate source.
// Multiple grids may be `activeForSnap` simultaneously; priority
// resolution is execution-phase (snap engine) concern.

import type { GridId, LayerId } from '../ids';
import type { Point2D } from './primitive';

export interface Grid {
  id: GridId;
  origin: Point2D;
  /** Radians, CCW from +X. */
  angle: number;
  spacingX: number;
  spacingY: number;
  layerId: LayerId;
  visible: boolean;
  activeForSnap: boolean;
}

export type GridSnapshot = Grid;
