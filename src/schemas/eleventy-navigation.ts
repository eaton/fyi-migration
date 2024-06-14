import { z } from 'zod';
import { urlSchema } from './url.js';

export const EleventyNavigationSchema = z
  .object({
    key: z.string().optional(),
    title: z.string().optional(),
    excerpt: z.string().optional(),
    parent: z.string().optional(),
    order: z.number().optional(),
    url: urlSchema.optional(),
  })
  .describe("Metadata to control Eleventy's nav + breadcrumb plugin.");

export type EleventyNavigation = z.infer<typeof EleventyNavigationSchema>;
