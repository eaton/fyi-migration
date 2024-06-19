import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';
import { urlSchema } from './fragments/index.js';

export const SlideSchema = z.object({
  image: z.string().optional(),
  alt: z.string().optional(),
  text: z.string().optional(),
  isBonusSlide: z.coerce.boolean().optional()
});
export type Slide = z.infer<typeof SlideSchema>;

export const TalkEventSchema = z.object({
  event: z.string().optional(),
  date: z.coerce.date().optional(),
  withTitle: z.string().optional(),
  isFeaturedVersion: z.coerce.boolean().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
});
export type TalkInstance = z.infer<typeof TalkEventSchema>;

export const TalkSchema = CreativeWorkSchema.extend({
  type: z.string().default('Talk'),
  performances: z.array(TalkEventSchema).optional(),
  keySlide: z.number().optional(),
  video: urlSchema.optional(),
  audio: urlSchema.optional(),
  slide: z.array(SlideSchema).optional(),
  pdf: urlSchema.optional(),
  cuesheet: urlSchema.optional(),
  transcript: urlSchema.optional(),
  featured: z.string().optional(),
});
export type Talk = z.infer<typeof TalkSchema>;
