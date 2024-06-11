import { type ExtractTemplateObject } from '@eatonfyi/html';
import { z } from 'zod';
import { DimensionsSchema } from '../../schemas/index.js';

const optionalString = z
  .string()
  .trim()
  .transform(s => (s.length ? s : undefined))
  .optional();

export const template: ExtractTemplateObject = {
  asin: 'input[name=asin],input[name=ASIN] | attr:value',

  // The product title is often jammed together with other metadata like
  // Edition or Publication date.
  title: '#productTitle | trim',

  // This only appears when you're logged in, but if we start using Playwright and
  // or a browser extension to scrape this stuff, it's an easy way to yoink the purchase
  // date. Note that it appears if ANY format/edition was purchased, not just the current
  // one.
  purchased: '#booksInstantOrderUpdate',

  // Author URLs also exist, but are messy; we'd rather just ignore them.
  // Also note that if one person has multiple roles in a work, they get one
  // entry in this list with multiple roles jammed into one line. That needs
  // to be fixed before we convert this into an actual book record.
  creator_entries: [
    {
      $: '#bylineInfo span.author',
      name: 'a',
      url: 'a | attr:href',
      role: '.contribution',
    },
  ],

  // The format of the book instance currently being viewed.
  format: 'div#formats > div > div > div.selected span.slot-title > span',

  // This can be formatted in several ways, and MAY include series name, the current book's order
  // in the series, and the total number of books in the series.
  series: '#seriesBulletWidget_feature_div',

  // By default we always pick the first one, but we'll save these in the cache
  // in case there's a better option down the line.
  images: {
    $: 'div.imgTagWrapper img',
    alt: '| attr:alt',
    src: '| attr:src',
    hires: '| attr:data-old-hires',
  },

  // Usually contains product varitions
  twister: [
    {
      $: '#twister div.a-row',
      label: '> label',
      value: '> span',
    },
  ],

  // Most of the book 'features' like publisher name, publication date, dimensions, page count,
  // etc are listed in a rotator under the title/author information. They're usually less crufty
  // than the raw 'features' collection.
  carousel: [
    {
      $: 'div.rpi-attribute-content',
      key: '| attr:id | split:- | last',
      label: '> .rpi-attribute-label span',
      value: '> .rpi-attribute-value | pad | text',
    },
  ],

  overview: amazonDataTable('#productOverview_feature_div').pattern,
  details: amazonDataTable('#prodDetails').pattern,
  features: amazonDataTable('#poExpander').pattern,
  info: amazonDataBullets('#detailBulletsWrapper_feature_div').pattern,
};

export const schema = z.object({
  ids: z.record(z.string()).optional(),
  asin: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  image: z.string().optional(),
  publisher: z.string().optional(),
  imprint: z.string().optional(),
  edition: z.string().optional(),
  series: optionalString,
  position: optionalString,
  pages: z.number().optional(),
  format: optionalString,
  date: optionalString,
  creator: z.record(z.array(z.string())).optional(),
  dimensions: DimensionsSchema.optional(),

  creator_entries: z
    .array(
      z.object({
        role: optionalString,
        name: z.string().default('author'),
      }),
    )
    .optional(),

  images: z
    .object({
      alt: optionalString,
      src: optionalString,
      hires: optionalString,
    })
    .optional(),

  carousel: amazonDataTable().schema,
  overview: amazonDataTable().schema,
  details: amazonDataTable().schema,
  twister: amazonDataBullets().schema,
  features: amazonDataBullets().schema,
  info: amazonDataBullets().schema,
});

export type ParsedAmazonData = z.infer<typeof schema>;

function amazonDataTable(selector?: string) {
  return {
    pattern: [
      {
        $: `${selector} tr`,
        key: '| attr:class | split: | index:1',
        label: 'th',
        value: 'td:nth-child(2)',
      },
    ],
    schema: z.array(
      z.object({
        key: optionalString,
        label: optionalString.transform(t =>
          t?.replaceAll(/[^\w ]/g, ' ').trim(),
        ),
        value: optionalString,
      }),
    ),
  };
}

// #detailBullets_feature_div for books, #feature-bullets for games and other products
function amazonDataBullets(selector?: string) {
  return {
    pattern: [
      {
        $: `${selector} li span.a-list-item`,
        label: 'span:nth-child(1)',
        value: 'span:nth-child(2)',
      },
    ],
    schema: z.array(
      z.object({
        label: optionalString.transform(t =>
          t?.replaceAll(/[^\w ]/g, ' ').trim(),
        ),
        value: optionalString,
      }),
    ),
  };
}
