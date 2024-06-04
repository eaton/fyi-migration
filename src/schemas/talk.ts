import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';

// Use isPartOf
export const TalkSchema = CreativeWorkSchema.extend({
  type: z.string().default('Talk'),
  keySlide: z.number().optional(),
  video: z.string().optional(),
  audio: z.string().optional(),
  slides: z.string().optional(),
  cuesheet: z.string().optional(),
  transcript: z.string().optional(),
});
export type Talk = z.infer<typeof TalkSchema>;
