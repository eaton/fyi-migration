import jetpack from '@eatonfyi/fs-jetpack';
import { toText } from '@eatonfyi/html';
import { parse as parsePath } from 'path';
import { z } from 'zod'; // This is for reading the raw twitter archive data files, a thing that is horrifyingly necessary because the world is full of pain.
import { TweetSchema } from './schema.js';

export async function parseRawArchive(archivePath: string) {
  const archive = jetpack.dir(archivePath);

  const account = await archive
    .readAsync('account.json', 'auto')
    .then((account: unknown) => accountFile.parse(account).pop()?.account);

  const profile = await archive
    .readAsync('profile.json', 'auto')
    .then((profile: unknown) => profileFile.parse(profile).pop()?.profile);

  const parsedTweets = await archive
    .readAsync('tweets.json', 'auto')
    .then((tweets: unknown) => tweetsFile.parse(tweets));

  if (!account || !profile || !parsedTweets) {
    throw new Error('Problem parsing. Debug it, you lazy SOB.');
  }

  const user = {
    id: 'twt-@' + account.username,
    id_str: account.accountId,
    name: account.username,
    displayName: account.accountDisplayName,
    date: account.createdAt,
    image: profile.avatarMediaUrl,
    description: profile.description.bio,
    url: profile.description.website,
  };

  const tweets = parsedTweets.map(t => mangleTweet(t.tweet, user.name));

  return { user, tweets };
}

function mangleTweet(input: z.infer<typeof fileTweet>, handle: string) {
  const output = TweetSchema.parse({
    id: input.id_str,
    handle,
    date: input.created_at,
    text: input.full_text,
    source: input.source ? toText(input.source) : undefined,
    aboutId: input.in_reply_to_status_id_str,
    aboutHandle: input.in_reply_to_screen_name,
    favorites: input.favorite_count,
    retweets: input.retweet_count,
    links: Object.fromEntries(
      input.entities?.urls.map(u => [u.url, u.expanded_url]) ?? [],
    ),
    media: mangleMedia(input),
  });
  return output;
}

function mangleMedia(input: z.infer<typeof fileTweet>) {
  const mediaMap: Record<string, string[]> = {};
  for (const em of input.extended_entities?.media ?? []) {
    const variant = em.video_info?.variants
      ?.filter(v => v.content_type === 'video/mp4')
      .pop();
    const filename = parsePath(variant?.url ?? em.media_url_https).base.split(
      '?',
    )[0];

    if (filename) {
      mediaMap[em.url] ??= [];
      mediaMap[em.url].push(`media://twitter/${filename}`);
    }
  }
  return mediaMap;
}

const accountFile = z.array(
  z.object({
    account: z.object({
      email: z.string().email().optional(),
      createdVia: z.string().optional(),
      username: z.string(),
      accountId: z.coerce.string(),
      createdAt: z.coerce.date(),
      accountDisplayName: z.string().optional(),
    }),
  }),
);

const profileFile = z.array(
  z.object({
    profile: z.object({
      description: z.object({
        bio: z.string().optional(),
        website: z.string().optional(),
      }),
      avatarMediaUrl: z.string().optional(),
    }),
  }),
);

const fileTweet = z.object({
  source: z.string().optional(),
  entities: z
    .object({
      urls: z
        .array(
          z.object({
            url: z.string(),
            expanded_url: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),
  favorite_count: z.coerce.number(),
  id_str: z.coerce.string(),
  in_reply_to_status_id_str: z.coerce.string().optional(),
  in_reply_to_user_id: z.coerce.string().optional(),
  in_reply_to_screen_name: z.string().optional(),
  in_reply_to_user_id_str: z.coerce.string().optional(),
  retweet_count: z.coerce.number(),
  created_at: z.coerce.date(),
  full_text: z.string(),
  extended_entities: z
    .object({
      media: z
        .array(
          z.object({
            id_str: z.string(),
            url: z.string(),
            expanded_url: z.string(),
            media_url_https: z.string(),
            type: z.string(),
            display_url: z.string(),
            video_info: z
              .object({
                variants: z
                  .array(
                    z.object({
                      content_type: z.string(),
                      url: z.string(),
                    }),
                  )
                  .default([]),
              })
              .optional(),
          }),
        )
        .default([]),
    })
    .optional(),
});

const tweetsFile = z.array(z.object({ tweet: fileTweet }));
