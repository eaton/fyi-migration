import { z } from 'zod';
import { CreativeWorkSchema } from '../creative-work.js';

export const EpisodeSchema = CreativeWorkSchema.extend({
  type: z.string().default('Episode'),
  duration: z.coerce.string().optional().describe('ISO 8601 duration format'),
  episodeNumber: z.coerce.number().optional(),
  musicBy: z.string().optional()
});

export type Episode = z.infer<typeof EpisodeSchema>;
