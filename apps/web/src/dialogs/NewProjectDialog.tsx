// M1.2 Phase 5 — minimal modal for the single "new project" flow.
// Form has one field (project name). On submit, builds a fresh Project
// value and calls createNewProject() on the vanilla store.

import {
  type CoordinateSystem,
  LayerId,
  type Project,
  type ProjectId,
  defaultLayer,
  newProjectId,
} from '@portplanner/domain';
import { createNewProject } from '@portplanner/project-store';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import styles from './NewProjectDialog.module.css';

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

function buildProject(name: string): Project {
  const now = new Date().toISOString();
  const coordinateSystem: CoordinateSystem | null = null;
  return {
    id: newProjectId() as ProjectId,
    schemaVersion: '1.2.0',
    name,
    createdAt: now,
    updatedAt: now,
    coordinateSystem,
    objects: {},
    primitives: {},
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {},
    scenarioId: null,
  };
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      setError('Name must be 1–100 characters.');
      return;
    }
    createNewProject(buildProject(trimmed));
    setName('');
    setError(null);
    onClose();
  }

  function handleCancel() {
    setName('');
    setError(null);
    onClose();
  }

  return (
    <div className={styles.backdrop}>
      <dialog open className={styles.dialog} aria-labelledby="new-project-title">
        <form onSubmit={handleSubmit} className={styles.form}>
          <h2 id="new-project-title" className={styles.title}>
            New project
          </h2>
          <label className={styles.label}>
            <span>Project name</span>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              aria-invalid={error !== null}
            />
          </label>
          {error !== null && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className={styles.submit}>
              Create
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
