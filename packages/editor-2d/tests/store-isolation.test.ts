// I-68 store-isolation meta-test (Gate 22.7, Revision-4 + §13
// mid-execution refinement).
//
// Walks `packages/editor-2d/src/` recursively and asserts only
// `EditorRoot.tsx` holds BOTH a project-store subscription AND an
// editor-2d UI-store subscription. One-shot `.getState()` reads are
// not subscriptions and do NOT trigger the gate (this is what makes
// tools/copy.ts, tools/move.ts, tools/undo.ts, tools/redo.ts —
// which read both stores via getState — legitimate non-offenders).
//
// Subscription signals:
//   - project store: `\bprojectStore\.subscribe\(` OR
//                    `\bprojectStore\.temporal\.subscribe\(`
//   - editor UI:     `\buseEditorUi\(` OR
//                    `\beditorUiStore\.subscribe\(`
// One-shot accesses like `projectStore.getState()` or
// `projectStore.temporal.getState().undo()` do not match.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = 'src';
const ALLOWED_DUAL_SUBSCRIBER = 'EditorRoot.tsx';

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(full)) {
      yield full;
    }
  }
}

const PROJECT_SUBSCRIBE = /\bprojectStore\.subscribe\(/;
const PROJECT_TEMPORAL_SUBSCRIBE = /\bprojectStore\.temporal\.subscribe\(/;
const UI_HOOK = /\buseEditorUi\(/;
const UI_STORE_SUBSCRIBE = /\beditorUiStore\.subscribe\(/;

describe('I-68: dual-store subscription confined to EditorRoot (Gate 22.7)', () => {
  it('only EditorRoot subscribes to both projectStore and useEditorUi', () => {
    const offenders: string[] = [];

    for (const filePath of walk(SRC_ROOT)) {
      const src = readFileSync(filePath, 'utf8');
      const subscribesProject = PROJECT_SUBSCRIBE.test(src) || PROJECT_TEMPORAL_SUBSCRIBE.test(src);
      const subscribesUi = UI_HOOK.test(src) || UI_STORE_SUBSCRIBE.test(src);

      if (subscribesProject && subscribesUi && !filePath.endsWith(ALLOWED_DUAL_SUBSCRIBER)) {
        offenders.push(filePath);
      }
    }

    expect(
      offenders,
      `dual-store subscribers other than EditorRoot.tsx: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
