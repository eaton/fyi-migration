import { z } from 'zod';

export const TweetSchema = z.object({});
export type Tweet = z.infer<typeof TweetSchema>;
