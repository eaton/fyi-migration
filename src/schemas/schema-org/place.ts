import { z } from 'zod';
import { ThingSchema } from './thing.js';

export const PlaceSchema = ThingSchema.extend({
  type: z.string().default('Place'),
  isVirtual: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  population: z.number().optional(),
});

export type Place = z.infer<typeof PlaceSchema>;
