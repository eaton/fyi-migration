import { z } from 'zod';
import { urlSchema } from '../fragments/index.js';
import { CreativeWorkSchema } from '../schema-org/creative-work.js';

export const SlideSchema = z.object({
  image: z.string().optional(),
  alt: z.string().optional(),
  text: z.string().optional(),
  isBonusSlide: z.coerce.boolean().optional(),
});
export type Slide = z.infer<typeof SlideSchema>;

export const TalkEventSchema = z.object({
  event: z.string(),
  date: z.coerce.date().optional(),
  withTitle: z.string().optional(),
  isFeaturedVersion: z.coerce.boolean().optional(),
  description: z.string().optional(),
  recording: urlSchema.optional(),
  transcript: z.string().optional(),
  pdf: z.string().optional(),
  cuesheet: z.string().optional(),
  keynoteFile: z.string().optional(),
  url: z.string().optional(),
});
export type TalkInstance = z.infer<typeof TalkEventSchema>;

export const TalkSchema = CreativeWorkSchema.extend({
  type: z.string().default('Talk'),
  performances: z.array(TalkEventSchema).optional(),
  keySlide: z.number().optional(),
  slides: z.array(SlideSchema).optional(),
});
export type Talk = z.infer<typeof TalkSchema>;
