import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';
import { DimensionsSchema } from './fragments/dimensions.js';

export const BookSchema = CreativeWorkSchema.extend({
  type: z.string().default('Book'),
  ids: z.record(z.coerce.string()).optional(),
  subtitle: z.string().optional(),
  edition: z.string().optional(),
  imprint: z.string().optional(),
  format: z.string().optional(),
  series: z.string().optional(),
  position: z.coerce.number().optional(),
  pages: z.coerce.number().optional(),

  // Personal propertieså
  owned: z.string().optional(),
  source: z.string().optional(),
  category: z.string().optional(),
  dimensions: DimensionsSchema.optional(),
});
export type Book = z.infer<typeof BookSchema>;

export const PartialBookSchema = BookSchema.partial();
export type PartialBook = z.infer<typeof PartialBookSchema>;
