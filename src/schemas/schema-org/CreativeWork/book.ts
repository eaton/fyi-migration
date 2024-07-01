import { z } from 'zod';
import { SizeSchema } from '../../fragments/size.js';
import { CreativeWorkSchema } from '../creative-work.js';

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
  dimensions: SizeSchema.optional(),
});
export type Book = z.infer<typeof BookSchema>;

export const PartialBookSchema = BookSchema.partial();
export type PartialBook = z.infer<typeof PartialBookSchema>;
