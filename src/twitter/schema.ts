import { z } from 'zod';

export const TweetSchema = z.object({
  id: z.coerce.string(),
  date: z.coerce.date(),
  handle: z.string(),
  text: z.string(),

  thread: z
    .string()
    .optional()
    .describe('The ID of the topmost parent in a string of replies'),
  aboutId: z
    .string()
    .optional()
    .describe(
      'If the tweet is a reply, the ID of the status it is in reply to',
    ),
  aboutHandle: z
    .string()
    .optional()
    .describe('If the tweet is a reply, the ID of account it is replying to'),
  links: z.record(z.string().url()).optional(),
  media: z.record(z.array(z.string())).optional(),

  isRetweet: z.boolean().optional(),

  source: z.string().optional(),
  favorites: z.number().default(0),
  retweets: z.number().default(0),
  hashtags: z.array(z.string()).optional(),
});

export type Tweet = z.infer<typeof TweetSchema>;
export type TweetThread = {
  id: string;
  handle: string;
  aboutId?: string;
  aboutHandle?: string;
  start: Date;
  end: Date;
  favorites: number;
  retweets: number;
  tweets: Tweet[];
};
