import { extract, ExtractTemplateObject } from '@eatonfyi/html';
import { z } from 'zod';

export type Post = z.infer<typeof postSchema>;
export type Thread = z.infer<typeof threadSchema>;
export type Category = z.infer<typeof categorySchema>;

export type Options = {
  /**
   * Description placeholder
   */
  groupContainers?: boolean;

  /**
   * Description placeholder
   */
  discardEmpty?: boolean;

  /**
   * Description placeholder
   */
  discardSpam?: boolean;

  /**
   * Description placeholder
   */
  discardDeleted?: boolean;

  /**
   * Description placeholder
   */
  sortPosts?: boolean;

  /**
   * Description placeholder
   */
  sortThreads?: boolean;

  /**
   * Description placeholder
   */
  populatePosts?: boolean;
};

export const defaults: Options = {
  groupContainers: true,
  discardDeleted: true,
  discardSpam: true,
  discardEmpty: true,
  sortPosts: true,
  sortThreads: true,
  populatePosts: true,
};

/**
 * Description placeholder
 */
export async function parse(xml: string | Buffer, options: Options = {}) {
  const extracted = await extract(
    xml ?? '',
    DisqusXmlTemplate,
    DisqusXmlSchema,
    { xml: true },
  );

  let categories = extracted.categories ?? [];
  let threads = extracted.threads ?? [];
  let posts = extracted.posts ?? [];

  // Do this up-front to reduce work later
  if (options.discardDeleted) posts = posts.filter(p => !p.isDeleted);
  if (options.discardSpam) posts = posts.filter(p => !p.isSpam);

  if (options.sortPosts) {
    // Order the posts by date, which puts 'earliest' posts first.
    // Then loop through the posts, creating a 'sort string'
    posts.sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf());
    for (const post of posts) {
      post.sort =
        '/' +
        (post.parent ? byId(posts, post.parent)?.dsqId + '/' : '') +
        post.id;
    }
    posts.sort((a, b) => a.sort!.localeCompare(b.sort!));
  }

  for (const t of threads) {
    const threadPosts = posts.filter(p => p.thread === t.dsqId);
    if (options.populatePosts) {
      for (const post of threadPosts) {
        post.forum = t.forum;
        post.category = t.category;
        post.link = t.link;
        post.linkId = t.id;
      }
    }

    if (options.groupContainers) {
      t.posts = threadPosts;
      // Sort 'em again just to be sure the filter didn't mess anything up.
      if (options.sortPosts) {
        threadPosts.sort(
          (a, b) => a.createdAt.valueOf() - b.createdAt.valueOf(),
        );
      }
    }
  }

  function byId(posts: { dsqId: string }[], id: string) {
    return posts.find(p => p.dsqId === id);
  }

  if (options.discardEmpty && options.groupContainers) {
    threads = threads.filter(t => !t.posts?.length);
  }

  if (options.sortThreads) {
    threads.sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf());
  }

  if (options.groupContainers) {
    for (const c of categories) {
      c.threads = threads.filter(t => t.category === c.dsqId);
    }
  }
  if (options.discardEmpty && options.groupContainers) {
    categories = categories.filter(c => !c.threads?.length);
  }

  return {
    categories,
    threads,
    posts,
  };
}

/** @see {@link https://help.disqus.com/en/articles/1717164-comments-export } */
export const DisqusXmlTemplate: ExtractTemplateObject = {
  categories: [
    {
      $: 'disqus > category',
      dsqId: '| xmlAttr:dsq%id',
      forum: '> forum',
      title: '> title',
      isDefault: '> isDefault',
    },
  ],
  threads: [
    {
      $: 'disqus > thread',
      dsqId: '| xmlAttr:dsq%id',
      id: '> id',
      forum: '> forum',
      category: '> category | xmlAttr:dsq%id',
      link: '> link',
      title: '> title',
      message: '> message',
      createdAt: '> createdAt',
      author: {
        $: '> author',
        name: '> name | text',
        isAnonymous: '> isAnonymous',
        username: '> username | text',
      },
      isClosed: '> isClosed',
      isDeleted: '> isDeleted',
    },
  ],
  posts: [
    {
      $: 'disqus > post',
      dsqId: '| xmlAttr:dsq%id',
      id: '> id',
      message: '> message',
      createdAt: '> createdAt',
      isDeleted: '> isDeleted',
      isSpam: '> isSpam',
      author: {
        $: '> author',
        name: '> name | text',
        isAnonymous: '> isAnonymous',
        username: '> username | text',
      },
      thread: '> thread | xmlAttr:dsq%id',
      parent: '> parent | xmlAttr:dsq%id',
    },
  ],
};

const authorSchema = z.object({
  name: z.string().optional(),
  isAnonymous: z.unknown(),
  username: z.string().optional(),
});

const postSchema = z
  .object({
    dsqId: z.coerce.string(),
    wp_id: z.coerce.string(),
    forum: z
      .string()
      .optional()
      .describe(
        'Not present in native export; optionally populated with the forum name.',
      ),
    category: z
      .string()
      .optional()
      .describe(
        "Not present in native export; optionally populated with the category ID of the post's thread.",
      ),
    thread: z.coerce.string(),
    parent: z.coerce.string().optional(),
    sort: z
      .string()
      .optional()
      .describe(
        'Not present in native export; optionally populated with a thread-aware sorting key.',
      ),
    createdAt: z.coerce.date(),
    isSpam: z.unknown(),
    isDeleted: z.unknown(),
    link: z
      .string()
      .optional()
      .describe(
        'Not present in native export. Optionally populated with the link the thread replies to.',
      ),
    linkId: z
      .string()
      .optional()
      .describe(
        'Not present in native export. Optionally populated with the ID of the link the thread replies to.',
      ),
    author: authorSchema,
    message: z.string(),
  })
  .passthrough();

const threadSchema = z
  .object({
    dsqId: z.coerce.string(),
    id: z.coerce.string(),
    forum: z.string().optional(),
    category: z.string().optional(),
    link: z.string().optional(),
    title: z.string().optional(),
    createdAt: z.coerce.date(),
    author: authorSchema,
    isClosed: z.unknown(),
    isDeleted: z.unknown(),
    posts: z
      .array(postSchema)
      .default([])
      .describe(
        'Not present in native export; optionally populated with all posts in a thread.',
      ),
  })
  .passthrough();

const categorySchema = z.object({
  dsqId: z.coerce.string(),
  forum: z.string().optional(),
  title: z.string(),
  isDefault: z.unknown(),
  threads: z
    .array(threadSchema)
    .default([])
    .describe(
      'Not present in native export; optionally populated with all threads in a category.',
    ),
});

export const DisqusXmlSchema = z.object({
  categories: z.array(categorySchema),
  threads: z.array(threadSchema).optional(),
  posts: z.array(postSchema).optional(),
});
