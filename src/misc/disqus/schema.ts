import { z } from 'zod';
import { ExtractTemplateObject } from '@eatonfyi/html';

export const xmlTemplate: ExtractTemplateObject = {
  categories: [{
    $: 'disqus > category',
    dsqId: '| xmlAttr:dsq%id',
    forum: '> forum',
    title: '> title',
    isDefault: '> isDefault'
  }],
  threads: [{
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
  }],
  posts: [{
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
  }]
}

export const categorySchema = z.object({
  dsqId: z.coerce.string(),
  forum: z.string().optional(),
  title: z.string(),
  isDefault: z.unknown(),
});

const authorSchema = z.object({
  name: z.string().optional(),
  isAnonymous: z.unknown(),
  username: z.string().optional(),
});

export const postSchema = z.object({
  dsqId: z.coerce.string(),
  wp_id: z.coerce.string(),
  thread: z.coerce.string(),
  parent: z.coerce.string().optional(),
  createdAt: z.coerce.date(),
  isSpam: z.unknown(),
  isDeleted: z.unknown(),
  author: authorSchema,
  message: z.string(),
}).passthrough();

export const threadSchema = z.object({
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
  posts: z.array(postSchema).default([]),
}).passthrough();


export const disqusSchema = z.object({
  categories: z.array(categorySchema),
  threads: z.array(threadSchema).optional(),
  posts: z.array(postSchema).optional(),
});

export type Post = z.infer<typeof postSchema>
export type Thread = z.infer<typeof threadSchema>;
export type Category = z.infer<typeof categorySchema>;

/*
<category dsq:id="1276385">
  <forum>angrylittletree</forum>
  <title>General</title>
  <isDefault>true</isDefault>
</category>
<thread dsq:id="573937173">
  <id>/2011/05/gutters.html</id>
  <forum>angrylittletree</forum>
  <category dsq:id="1276385" />
  <link>http://angrylittletree.com/2011/05/gutters.html</link>
  <title>Gutters - Angry Little Tree</title>
  <message />
  <createdAt>2012-02-13T03:17:15Z</createdAt>
  <author>
    <name>Jeff Eaton</name>
    <isAnonymous>false</isAnonymous>
    <username>angrylittletree</username>
  </author>
  <isClosed>false</isClosed>
  <isDeleted>false</isDeleted>
</thread>
<post dsq:id="437331231">
  <id>wp_id=1446</id>
  <message>
<![CDATA[<p>Hi Eaton</p><p>Today I was here...</p>]]>
  </message>
  <createdAt>2011-05-23T17:45:38Z</createdAt>
  <isDeleted>false</isDeleted>
  <isSpam>false</isSpam>
  <author>
    <name>Alek</name>
    <isAnonymous>true</isAnonymous>
  </author>
  <thread dsq:id="573937173" />
</post>
*/