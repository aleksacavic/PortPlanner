// editor-2d UI state store — vanilla zustand + immer.
// NO zundo: UI state is not undoable per ADR-015 (I-35).
//
// Slices: viewport, selection, activeTool, toggles, command-bar, focus,
// overlay. Each slice declares its own shape; the store composes them
// into a single state object exposed via projectEditorUiStore.

import type { LayerId, PrimitiveId } from '@portplanner/domain';
import { immer } from 'zustand/middleware/immer';
import { createStore } from 'zustand/vanilla';

import type { Viewport } from '../canvas/view-transform';

export type FocusHolder = 'canvas' | 'bar' | 'dialog';

export interface CommandBarHistoryEntry {
  role: 'prompt' | 'input' | 'response' | 'error';
  text: string;
  timestamp: string;
}

export interface SubOption {
  label: string;
  shortcut: string;
}

export interface CommandBarState {
  activePrompt: string | null;
  subOptions: SubOption[];
  defaultValue: string | null;
  inputBuffer: string;
  history: CommandBarHistoryEntry[];
  activeToolId: string | null;
}

export interface OverlayState {
  /** Snap target highlighted under cursor, in metric. */
  snapTarget: { x: number; y: number } | null;
  /** Guides drawn during a tool prompt (e.g., ortho-axis lines). */
  guides: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  /** Selection handles to draw on top of selected entities. */
  selectionHandles: Array<{ x: number; y: number }>;
}

export interface EditorUiState {
  viewport: Viewport;
  selection: PrimitiveId[];
  activeToolId: string | null;
  activeLayerId: LayerId | null;
  toggles: {
    osnap: boolean;
    ortho: boolean;
    gsnap: boolean;
    dynamicInput: boolean;
  };
  commandBar: CommandBarState;
  focusHolder: FocusHolder;
  /** Stack of previous focus holders so dialog open/close can restore. */
  focusStack: FocusHolder[];
  overlay: OverlayState;
}

const HISTORY_CAP = 200;

export const createInitialEditorUiState = (): EditorUiState => ({
  viewport: {
    panX: 0,
    panY: 0,
    zoom: 10,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    canvasWidthCss: 800,
    canvasHeightCss: 600,
  },
  selection: [],
  activeToolId: null,
  activeLayerId: null,
  toggles: {
    osnap: true,
    ortho: false,
    gsnap: true,
    dynamicInput: true,
  },
  commandBar: {
    activePrompt: null,
    subOptions: [],
    defaultValue: null,
    inputBuffer: '',
    history: [],
    activeToolId: null,
  },
  focusHolder: 'canvas',
  focusStack: [],
  overlay: {
    snapTarget: null,
    guides: [],
    selectionHandles: [],
  },
});

export const editorUiStore = createStore<EditorUiState>()(immer(() => createInitialEditorUiState()));

// --- Slice action helpers (typed mutators) ----------------------------

export const editorUiActions = {
  setViewport(patch: Partial<Viewport>): void {
    editorUiStore.setState((s) => {
      Object.assign(s.viewport, patch);
    });
  },
  setSelection(ids: PrimitiveId[]): void {
    editorUiStore.setState((s) => {
      s.selection = ids;
    });
  },
  setActiveToolId(id: string | null): void {
    editorUiStore.setState((s) => {
      s.activeToolId = id;
      s.commandBar.activeToolId = id;
    });
  },
  setActiveLayerId(id: LayerId | null): void {
    editorUiStore.setState((s) => {
      s.activeLayerId = id;
    });
  },
  toggleOsnap(): void {
    editorUiStore.setState((s) => {
      s.toggles.osnap = !s.toggles.osnap;
    });
  },
  toggleOrtho(): void {
    editorUiStore.setState((s) => {
      s.toggles.ortho = !s.toggles.ortho;
    });
  },
  toggleGsnap(): void {
    editorUiStore.setState((s) => {
      s.toggles.gsnap = !s.toggles.gsnap;
    });
  },
  toggleDynamicInput(): void {
    editorUiStore.setState((s) => {
      s.toggles.dynamicInput = !s.toggles.dynamicInput;
    });
  },
  setPrompt(prompt: string | null, subOptions: SubOption[] = [], defaultValue: string | null = null): void {
    editorUiStore.setState((s) => {
      s.commandBar.activePrompt = prompt;
      s.commandBar.subOptions = subOptions;
      s.commandBar.defaultValue = defaultValue;
      s.commandBar.inputBuffer = '';
    });
  },
  appendHistory(entry: CommandBarHistoryEntry): void {
    editorUiStore.setState((s) => {
      s.commandBar.history.push(entry);
      if (s.commandBar.history.length > HISTORY_CAP) {
        s.commandBar.history.splice(0, s.commandBar.history.length - HISTORY_CAP);
      }
    });
  },
  setInputBuffer(value: string): void {
    editorUiStore.setState((s) => {
      s.commandBar.inputBuffer = value;
    });
  },
  setFocusHolder(holder: FocusHolder): void {
    editorUiStore.setState((s) => {
      s.focusHolder = holder;
    });
  },
  pushFocusAndSet(next: FocusHolder): void {
    editorUiStore.setState((s) => {
      s.focusStack.push(s.focusHolder);
      s.focusHolder = next;
    });
  },
  popFocus(): void {
    editorUiStore.setState((s) => {
      const prev = s.focusStack.pop();
      s.focusHolder = prev ?? 'canvas';
    });
  },
  setOverlay(patch: Partial<OverlayState>): void {
    editorUiStore.setState((s) => {
      Object.assign(s.overlay, patch);
    });
  },
};

export function resetEditorUiStoreForTests(): void {
  editorUiStore.setState(createInitialEditorUiState(), true);
}

export { HISTORY_CAP };
