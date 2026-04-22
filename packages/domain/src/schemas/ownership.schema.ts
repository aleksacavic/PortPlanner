import { z } from 'zod';

export const OwnershipStateSchema = z.enum(['AUTHORED', 'GENERATED', 'FROZEN', 'DETACHED']);
