import { TwitterArchive } from 'twitter-archive-reader';
import { CreativeWorkSchema } from '../../schemas/index.js';
import { SocialMediaPostingSchema } from '../../schemas/social-media-post.js';
import { Tweet } from './schema.js';

export function user(info: Record<string, string> | TwitterArchive) {
  if (info instanceof TwitterArchive) {
    return CreativeWorkSchema.parse({
      type: 'Blog',
      id: `@${info.user.screen_name.toLocaleLowerCase()}`,
      id_str: info.user.id,
      subtitle: info.user.name,
      date: info.user.created_at,
      image: info.user.profile_img_url,
      description: info.user.bio,
      url: handleUrl(info.user.screen_name),
      hosting: 'Twitter',
    });
  } else {
    return CreativeWorkSchema.parse({
      ...info,
      url: handleUrl(info.handle),
      hosting: 'Twitter',
    });
  }
}

export function tweet(tweet: Tweet) {
  return SocialMediaPostingSchema.parse({
    type: 'SocialMediaPosting',
    id: tweet.id,
    about: tweet.aboutId
      ? tweetUrl(tweet.aboutId, tweet.aboutHandle)
      : undefined,
    date: tweet.date,
    text: tweetToMarkdown(tweet),
    handle: tweet.handle,
    url: tweetUrl(tweet.id, tweet.handle),
    isPartOf: `@${tweet.handle.toLocaleLowerCase()}`,
    favorites: tweet.favorites,
    retweets: tweet.retweets,
    software: tweet.source,
    keywords: tweet.hashtags,
    isRetweet: tweet.isRetweet || undefined,
    sharedContent: Object.values(tweet.media ?? {}).flat(),
  });
}

export function thread(tweets: Tweet[]) {
  const first = tweets[0];
  const text = tweets.map(t => tweetToMarkdown(t)).join('\n\n');

  const cw = SocialMediaPostingSchema.parse({
    type: 'SocialMediaThread',
    id: first.id,
    handle: first.handle,
    isPartOf: `@${first.handle.toLocaleLowerCase()}`,
    about: first.aboutId
      ? tweetUrl(first.aboutId, first.aboutHandle)
      : undefined,
    date: first.date,
    dates: {
      start: first.date,
      end: tweets
        .map(t => t.date)
        .sort()
        .pop()!,
    },
    text,
    url: tweetUrl(first.id, first.handle),
    hasPart: tweets.map(t => tweetUrl(t.id, t.handle)),
    keywords: [...new Set(tweets.flatMap(t => t.hashtags ?? [])).values()],
    favorites: tweets
      .map(t => t.favorites)
      .reduce((partialSum, a) => partialSum + a, 0),
    retweets: tweets
      .map(t => t.retweets)
      .reduce((partialSum, a) => partialSum + a, 0),
    sharedContent: tweets.flatMap(t => Object.values(t.media ?? {}).flat()),
  });
  return cw;
}

export function tweetToMarkdown(tweet: Tweet) {
  let output = tweet.text;
  output = output.replaceAll(/\n+/g, '\n\n');

  // Remove the single link to the twitpic URL, and put each media item on its own line.
  // Later, we can wrap them in something.
  for (const [short, mediaFiles] of Object.entries(tweet.media ?? {})) {
    output = output.replaceAll(short, '');
    output += mediaFiles.map(m => `\n\n![](${m})`);
  }

  // Humanize URLs; deal with expanding link shorteners later.
  for (const [short, long] of Object.entries(tweet.links ?? {})) {
    output = output.replaceAll(short, `[${long}](${long})`);
  }

  if (output.startsWith(`@${tweet.handle} `)) {
    output = output.replace(`@${tweet.handle} `, '');
  }

  return output;
}

export function tweetUrl(id: string, handle = 'twitter') {
  return `https://www.x.com/${handle}/status/${id}`;
}

export function handleUrl(id: string, handle = 'twitter') {
  return `https://www.x.com/${handle}`;
}
