import { z } from 'zod';
import { ExtractTemplateObject } from '@eatonfyi/html';
import { parse as parseDate } from '@eatonfyi/dates';

export const xmlTemplate: ExtractTemplateObject[] = [{
  $: 'entry',
  id: '> itemid | parseAs:int',
  date: '> eventtime',
  subject: '> subject',
  body: '> event',
  mood: '> current_mood',
  music: '> current_music',
  avatar: '> avatar',
  comments: [{
    $: '> comment',
    id: '> itemid | parseAs:int',
    parent: '> parent_itemid',
    date: '> eventtime',
    body: '> event',
    name: '> author > name',
    email: '> author > email',
  }]
}];

export const commentSchema = z.object({
  id: z.number(),
  entry: z.number().optional(),
  parent: z.string().optional().transform(p => p ? Number.parseInt(p) : undefined),
  date: z.string().transform(s => parseDate(s, 'yyyy-MM-dd HH:mm:ss', Date.now())),
  subject: z.string().optional(),
  body: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
});

export const entrySchema = z.object({
  id: z.number(),
  date: z.string().transform(s => parseDate(s, 'yyyy-MM-dd HH:mm:ss', Date.now())),
  subject: z.string().optional(),
  body: z.string().optional(),
  teaser: z.string().optional(),
  music: z.string().optional(),
  mood: z.string().optional(),
  avatar: z.string().optional(),
  comments: z.array(commentSchema).optional().transform(c => c?.length ? c : undefined )
});

export const xmlSchema = z.array(entrySchema);

export type LivejournalEntry = z.infer<typeof entrySchema>;
export type LivejournalComment = z.infer<typeof commentSchema>;
