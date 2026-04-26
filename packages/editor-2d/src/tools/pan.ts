import type { ToolGenerator } from './types';

export async function* panTool(): ToolGenerator {
  // Pan is largely modeless (middle-mouse-drag handled outside the tool
  // generator); the keyboard-activated form is a placeholder that
  // immediately commits — middle-mouse handler in canvas-host updates
  // viewport directly.
  return { committed: true, description: 'pan-mode (use middle-mouse-drag)' };
}
