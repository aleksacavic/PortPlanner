// Canonical JSON serializer per ADR-012 decision #11 and ADR-014.
// Round-trip invariant:
//   serialize(deserialize(serialize(x))) === serialize(x)
// Keys are sorted recursively so output is byte-stable across runs
// and across clients (no JSON.stringify key-order dependence).

import { ProjectSchema } from './schemas';
import type { Project } from './types';

/** Serialize a Project to canonical JSON (minified, sorted keys). */
export function serialize(project: Project): string {
  return JSON.stringify(sortKeysRecursively(project));
}

/**
 * Parse canonical JSON back to a Project, validating shape via Zod.
 * Throws LoadFailure on invalid JSON or shape mismatch.
 */
export function deserialize(raw: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new LoadFailure('Invalid JSON in stored project data.', err);
  }

  const result = ProjectSchema.safeParse(parsed);
  if (!result.success) {
    throw new LoadFailure(
      'This project file is from an incompatible version or has a malformed shape.',
      result.error,
    );
  }
  return result.data as Project;
}

/**
 * Error thrown by `deserialize` when stored data is unusable —
 * malformed JSON, schema mismatch, or incompatible `schemaVersion`.
 * The `cause` property carries the underlying ZodError or SyntaxError
 * for diagnostic logging.
 */
export class LoadFailure extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'LoadFailure';
    this.cause = cause;
  }
}

// --- Internal helpers ---------------------------------------------

function sortKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursively);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortKeysRecursively((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
