import { z } from 'zod';

export const CoordinateSystemSchema = z.object({
  originLat: z.number(),
  originLng: z.number(),
  trueNorthRotation: z.number(),
  utmZone: z.string(),
});
