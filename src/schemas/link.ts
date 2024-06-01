import { z } from 'zod';

export const linkSchema = z.object({
  id: z.string().describe('A nanohash of the normalized URL.'),
  url: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  date: z.date(),
  tags: z.array(z.string()).optional(),
  source: z
    .string()
    .optional()
    .describe(
      'The ID of the social media platform, web site, software, etc the item was sourced from. It should be a fully qualified ID, prefixed by the entity type.',
    ),
  meta: z.record(z.unknown()).optional(),
});

export type Link = z.infer<typeof linkSchema>;
