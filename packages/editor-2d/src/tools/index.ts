// Tool registry — maps ToolId to generator factory. The keyboard
// router resolves shortcuts to ToolId then looks up the factory here.

import type { ToolId } from '../keyboard/shortcuts';
import { copyTool } from './copy';
import { drawArcTool } from './draw/draw-arc';
import { drawCircleTool } from './draw/draw-circle';
import { drawLineTool } from './draw/draw-line';
import { drawPointTool } from './draw/draw-point';
import { drawPolylineTool } from './draw/draw-polyline';
import { drawRectangleTool } from './draw/draw-rectangle';
import { drawXlineTool } from './draw/draw-xline';
import { eraseTool } from './erase';
import { escapeTool } from './escape';
import { layerManagerTool } from './layer-manager';
import { moveTool } from './move';
import { panTool } from './pan';
import { propertiesTool } from './properties';
import { redoTool } from './redo';
import { selectTool } from './select';
import type { ToolGenerator } from './types';
import { undoTool } from './undo';
import { zoomTool } from './zoom';

const ESSENTIAL_REGISTRY: Partial<Record<ToolId, () => ToolGenerator>> = {
  select: selectTool,
  erase: eraseTool,
  move: moveTool,
  copy: copyTool,
  undo: undoTool,
  redo: redoTool,
  zoom: zoomTool,
  pan: panTool,
  properties: propertiesTool,
  'layer-manager': layerManagerTool,
  escape: escapeTool,
  'draw-point': drawPointTool,
  'draw-line': drawLineTool,
  'draw-polyline': drawPolylineTool,
  'draw-rectangle': drawRectangleTool,
  'draw-circle': drawCircleTool,
  'draw-arc': drawArcTool,
  'draw-xline': drawXlineTool,
};

export function lookupTool(id: ToolId): (() => ToolGenerator) | null {
  return ESSENTIAL_REGISTRY[id] ?? null;
}

export function registerTool(id: ToolId, factory: () => ToolGenerator): void {
  ESSENTIAL_REGISTRY[id] = factory;
}
