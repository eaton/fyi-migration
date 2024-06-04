import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';
import { DimensionsSchema } from './dimensions.js';

export const BookSchema = CreativeWorkSchema.extend({
  type: z.string().default('Book'),
  ids: z.record(z.string()).optional(),
  subtitle: z.string().optional(),
  edition: z.string().optional(),
  publisher: z.string().optional(),
  imprint: z.string().optional(),
  series: z.string().optional(),
  position: z.coerce.number().optional(),
  format: z.string().optional(),
  pages: z.number().optional(),

  // Personal properties
  owned: z.string().optional(),
  source: z.string().optional(),
  dimensions: DimensionsSchema.optional(),
});
export type Book = z.infer<typeof BookSchema>;
