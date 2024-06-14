import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';
import { DimensionsSchema } from './fragments/dimensions.js';
import { recordWithHints } from './fragments/index.js';

const semicolonList = z
  .string()
  .or(z.array(z.string()))
  .transform(i =>
    typeof i === 'string' ? i.split(';').map(s => s.trim()) : i,
  );
const defaultKey = z
  .record(semicolonList)
  .or(semicolonList)
  .transform(s => (Array.isArray(s) ? { author: s } : s));

export const BookSchema = CreativeWorkSchema.extend({
  type: z.string().default('Book'),
  ids: recordWithHints(z.coerce.string().optional(), [
    'ean',
    'upc',
    'isbn10',
    'isbn13',
    'asin',
    'loc',
    'dds',
    'custom',
  ]),
  dates: recordWithHints(z.coerce.date(), [
    'publish',
    'copyright',
    'obtained',
    'read',
  ]).optional(),
  creator: defaultKey.optional(),
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
  category: z.string().optional(),
  dimensions: DimensionsSchema.optional(),
});
export type Book = z.infer<typeof BookSchema>;

export const PartialBookSchema = BookSchema.partial();
export type PartialBook = z.infer<typeof PartialBookSchema>;
