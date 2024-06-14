import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';
import { urlSchema } from './fragments/index.js';

// Use isPartOf
export const TalkSchema = CreativeWorkSchema.extend({
  type: z.string().default('Talk'),
  keySlide: z.number().optional(),
  video: urlSchema.optional(),
  audio: urlSchema.optional(),
  slides: urlSchema.optional(),
  cuesheet: urlSchema.optional(),
  transcript: urlSchema.optional(),
  featured: z.string().optional(),
});
export type Talk = z.infer<typeof TalkSchema>;
