// Tool registry — maps ToolId to generator factory. The keyboard
// router resolves shortcuts to ToolId then looks up the factory here.

import type { ToolId } from '../keyboard/shortcuts';
import { copyTool } from './copy';
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
};

export function lookupTool(id: ToolId): (() => ToolGenerator) | null {
  return ESSENTIAL_REGISTRY[id] ?? null;
}

export function registerTool(id: ToolId, factory: () => ToolGenerator): void {
  ESSENTIAL_REGISTRY[id] = factory;
}
