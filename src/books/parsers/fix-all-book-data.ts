import jetpack from 'fs-jetpack';
import { z } from 'zod';
import { BookSchema } from './book.js';

type BookShape = z.infer<typeof BookSchema>;
const PartialBook = BookSchema.optional();
type PartialBookShape = z.infer<typeof PartialBook>;

type Rules = {
  imprints?: string[];
  publishers?: string[];
  series?: string[];
  editions?: string[];
  overrides?: Record<string, PartialBookShape>;
  titleCase?: boolean;
  trailingPunctuation?: boolean;
};

let loadedRules: Rules | undefined;

function loadRules(): Rules {
  if (loadedRules === undefined) {
    loadedRules = {};

    const dir = jetpack.dir('input/custom/rules');
    loadedRules.editions = dir.read('editions.txt')?.split('\n');
    loadedRules.publishers = dir.read('publishers.txt')?.split('\n');
    loadedRules.series = dir.read('series.txt')?.split('\n');
    loadedRules.imprints = dir.read('imprints.txt')?.split('\n');

    loadedRules.overrides = JSON.parse(dir.read('overrides.json') ?? '[]');
  }
  return loadedRules;
}

export function fixMetadata(input: BookShape): BookShape {
  const rules = loadRules();

  let book = input;
  for (const value of rules.imprints ?? []) {
    if (book.title.indexOf(wrap(value)) > 0) {
      book.title = book.title.replace(wrap(value), '').trim();
      book.imprint ??= value;
    }
  }
  for (const value of rules.publishers ?? []) {
    if (book.title.indexOf(wrap(value)) > 0) {
      book.title = book.title.replace(wrap(value), '').trim();
      book.publisher ??= value;
    }
  }
  for (const value of rules.series ?? []) {
    if (book.title.indexOf(wrap(value)) > 0) {
      book.title = book.title.replace(wrap(value), '').trim();
    } else {
      const regex = new RegExp(` \((${value}),? (Book|#)?(\d+)\)`);
      const [match, series, indicator, seriesOrder] =
        regex.exec(book.title) ?? [];
      if (match) book.title = book.title.replace(match, '').trim();
      if (series || seriesOrder) {
        book.series ??= {
          name: series.trim().length ? series.trim() : undefined,
          order: seriesOrder ? Number.parseInt(seriesOrder) : undefined,
        };
      }
    }
  }
  for (const value of rules.editions ?? []) {
    if (book.title.indexOf(wrap(value)) > 0) {
      book.title = book.title.replace(wrap(value), '').trim();
      book.edition ??= value;
    } else if (book.title.endsWith(', ' + value)) {
      book.title = book.title.replace(', ' + value, '').trim();
      book.edition ??= value;
    }
  }

  if (book.title.indexOf(':') > 0) {
    const [title, subtitle] = book.title.split(':');
    book.title = title.trim();
    book.subtitle = subtitle.trim();
  }

  for (const [key, values] of Object.entries(rules.overrides ?? {})) {
    if (Object.values(book.id ?? {}).includes(key)) {
      book = { ...book, ...values };
    }
  }

  return book;
}

function wrap(input: string, open = ' (', close = ')') {
  return open + input + close;
}
