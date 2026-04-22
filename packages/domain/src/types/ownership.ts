// Ownership state per ADR-003.
// Written as a string-literal const-object so values are ergonomic to
// read, but the derived type remains a strict union (no TS enum).

export const OwnershipState = {
  AUTHORED: 'AUTHORED',
  GENERATED: 'GENERATED',
  FROZEN: 'FROZEN',
  DETACHED: 'DETACHED',
} as const;

export type OwnershipState = (typeof OwnershipState)[keyof typeof OwnershipState];
