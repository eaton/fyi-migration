import { z } from 'zod';
import { oneOrMany, urlSchema } from '../../fragments/index.js';
import { CreativeWorkSchema } from '../creative-work.js';

export const SocialMediaPostingSchema = CreativeWorkSchema.extend({
  type: z.string().default('SocialMediaPosting'),
  sharedContent: oneOrMany(urlSchema).optional(),
});

export type SocialMediaPosting = z.infer<typeof SocialMediaPostingSchema>;
