import { z } from 'zod';

export const EleventyNavigationSchema = z
  .object({
    key: z.string().optional(),
    title: z.string().optional(),
    excerpt: z.string().optional(),
    parent: z.string().optional(),
    order: z.number().optional(),
    url: z.string().url().optional(),
  })
  .describe("Metadata to control Eleventy's nav + breadcrumb plugin.");

export type EleventyNavigation = z.infer<typeof EleventyNavigationSchema>;
