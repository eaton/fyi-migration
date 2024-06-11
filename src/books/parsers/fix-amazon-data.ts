import { reformat } from "@eatonfyi/dates";
import { ParsedAmazonData } from "./amazon-schema.js";

export function fixAmazonBookData(book: ParsedAmazonData, patterns: Record<string, string[]> = {}) {
  book.title = book.title?.trim();

  const image = book.images?.hires ?? book.images?.src;
  if (image) {
    book.image = fixAmazonImage(image);
  }
  book.format = book.format?.trim();

  book.creator = fixAmazonCreator(book.creator_entries ?? []);

  const info = mapKeyValues(book.info);
  const carousel = mapKeyValues(book.carousel);

  // Coerce a bunch of IDs
  book.ids ??= {};
  if (book.asin) book.ids.asin = book.asin;
  if (carousel.isbn10) book.ids.isbn10 = carousel.isbn10;
  if (carousel.isbn13) book.ids.isbn13 = carousel.isbn13;
  if (info.page_number_source_isbn) book.ids.isbn10 ??= info.page_number_source_isbn;
  
  // Attempt to extract series data
  if (carousel.series) {
    book.series = carousel.series?.trim();
  }
  if (carousel.seriesPosition) {
    const [, order, ] = /Book (\d+) of (\d+)/.exec(carousel.seriesPosition ?? '') ?? []
    book.position = order;
  }

  book.publisher ??= carousel.publisher || info.publisher;
  book.date = fixAmazonDate(carousel.publication_date || info.publication_date);
  if (info.publication_date) book.publisher = book.publisher?.replace(' (' + info.publication_date + ')', '');
  
  const pages = carousel.ebook_pages || carousel.fiona_pages || info.ebook_pages || info.print_length;
  if (pages) {
    book.pages = Number.parseInt(pages);
  }


  book = applyMetadataPatterns(book, patterns);
  book = splitTitle(book);
  book = fixAmazonTitles(book);
  book = removeDuplicateMetadata(book);

  return book;
}

function mapKeyValues(input: { key?: string, label?: string, value?: string }[]) {
  const entries = input.map(item => [(item.key ?? item.label)?.toLocaleLowerCase().replaceAll(/\s+/g, '_') ?? 'undefined', item.value]);
  const seriesData = input.find(i => i.key?.toLocaleLowerCase() === 'series');
  if (seriesData) {
    entries.push(['seriesPosition', seriesData.value]);
  }
  return Object.fromEntries(entries) as Record<string, string | undefined>;
}

// Attempts to detect common title/subtitle scenarios with colons and em dashes as separators.
// The complicating factor is detecting odd scenarios where a series name prefixes an otherwise
// bland title, or the colon an actual part of the title's text.
function splitTitle(book: ParsedAmazonData) {
  if (book.title) {
  const [title, subtitle] = book.title.split(/[:–]/, 2);
  if (subtitle) {
    if (similar(title, book.series) && (book.position !== "1")) {
      // Something like `Foobar: The Legend Of Baz` in the Foobar series; don't split this.
    } else {
      book.title = title.trim();
      if (!similar(subtitle, book.subtitle)) {
        book.subtitle = subtitle.trim();
      }
    }
  }
  }
  return book;
}

export function fixMetaDuplicatedInTitle(book: ParsedAmazonData) {
  if (!book.title) return book;
  const matches = book.title?.matchAll(/\s*([([](.+)[)\]])\s*/g) ?? []

  for (const [match, segment] of matches) {
    if (
      isCurEdition(segment, book)
      || isCurSeries(segment, book)
      || isCurPublisher(segment, book)
      || isCurImprint(segment, book)
      || isCurSubtitle(segment, book)
    ) {
      book.title = book.title.replace(match, '').trim();
    };
  }

  return book;
}

function isCurEdition(input: string, book: ParsedAmazonData) {
  if (!input) return false;
  if (similar(input, book.edition)) return true;
}

function isCurSeries(input: string, book: ParsedAmazonData) {
  if (!input) return false;
  if (similar(input, book.series)) return true;
  if (similar(input, Object.values(book.series ?? {}).join())) return true;
}

function isCurPublisher(input: string, book: ParsedAmazonData) {
  if (!input) return false;
  if (similar(input, book.publisher)) return true;
}

function isCurImprint(input: string, book: ParsedAmazonData) {
  if (!input) return false;
  if (similar(input, book.imprint)) return true;
}

function isCurSubtitle(input: string, book: ParsedAmazonData) {
  if (!input) return false;
  if (similar(input, book.subtitle)) return true;
}

function similar(input: string | undefined, comparison: string | undefined) {
  if (input === undefined || input.length === 0) return false;
return (strip(input) === strip(comparison));

function strip(i: string | undefined) {
  let o = i?.trim();
  if (o === undefined) return undefined;
  if (o.length === 0) return undefined;
  o = o.replaceAll(/[\s-_()[].]/g, '');
  o = o.toLocaleLowerCase();
  return o;
  }
}

function fixAmazonTitles(book: ParsedAmazonData) {
  if (book.title === undefined) return book;
  if (book.subtitle?.length === 0) book.subtitle = undefined;

  const [nssMatch, nssName, , , nssNum] = book.title?.match(/\((.+?)(,? ?(no|no\.|#|book|vol|volume)? ?(\d+))\)/i) ?? [];
  if (nssMatch) {
    book.series ??= nssName.trim();
    if (nssNum) book.position ??= nssNum;
    book.title = book.title?.replace(nssMatch, '').trim();
  }

  const [
    seriesMatch, seriesString, seriesName, , , , , orderNum
  ] = /\((([\s\w]+) +(series|duology|trilogy|quintet|sextet|sequence|cycle|saga|collection|novel)?(\s*)),? ?((book|no\.|#)? ?([\d+])?)\)/i.exec(book.title ?? '') ?? [];
  if (seriesMatch) {
    book.title = book.title?.replace(seriesMatch, '').trim();
    if (book.series === seriesName || book.series === seriesString) {
      // Hmmmmmm
    } else {
      book.series ??= seriesString.replace(', ', '').trim();
      if (orderNum) {
        book.position ??= orderNum;
      }
    }
  }

  // A common pattern for imprints…
  const [impMatch, impName, impTag] = book.title?.match(/\((.+ (classics|library))\)/i) ?? [];
  if (impMatch) {
    book.imprint ??= [impName.trim(), impTag.trim()].join(' ');
    book.title = book.title?.replace(impMatch, '').trim();
  }

  // Check for Editions in the title, whether duplicated or not.
  const [editionMatch, editionString, edition] = / *\((([\s\w]+) +(ed|ed\.|Edition))\)/i.exec(book.title ?? '') ?? [];
  if (editionMatch) {
    if (book.edition === undefined) {
      book.edition = edition + ' Edition';
    } else if (book.edition === editionString || book.edition === edition) {
      // do nothing
    } else {
      // we might want to check on this
    }
    book.title = book.title?.replace(editionMatch, '').trim();
  }

  // If — after all that — there's a colon followed by a space in the title,
  // split it and make the second half the subtitle.
  const [newTitle, newSubtitle] = book.title?.split(': ', 2) ?? [];
  if (newTitle.trim() !== book.series) {
    if (book.subtitle === undefined || book.subtitle === newSubtitle?.trim()) {
      book.subtitle = newSubtitle?.trim();
      book.title = newTitle.trim();
    }
  }

  // "Book Name, The" should be "The Book Name".
  // There are a few of these out there. Might as well catch 'em.
  if (book.title?.endsWith(', The')) {
    book.title = 'The ' + book.title?.replace(', The', '');
  }

  if (book?.series && book.subtitle?.endsWith(wrap(book?.series))) {
    book.subtitle = book.subtitle.replace(wrap(book?.series), '').trim();
  }

  // Some of our edits may leave dangling colons at the end of the title —
  // catch them.
  book.title = book.title.replace(/: $/, '');

  return book;
}

function removeDuplicateMetadata(book: ParsedAmazonData) {
  if (book.title === undefined) return book;

  if (book.publisher) book.title = book.title.replace(`${book.publisher}`, '').replaceAll('()', '').trim();
  if (book.imprint) {
    book.title = book.title.replace(`${book.imprint}`, '').replaceAll('()', '').trim();
    if (book.publisher) {
      book.publisher = book.publisher.replace(`${book.imprint}`, '').replaceAll('()', '').trim();
    }
  }
  if (book.edition) {
    book.title = book.title.replace(`${book.edition}`, '').replaceAll('()', '').trim();
    if (book.publisher) {
      book.publisher = book.publisher.replace(`${book.edition}`, '').replaceAll('()', '').trim();
    }
  }
  if (book.series) {
    book.title = book.title?.replace(wrap(book.series), '').trim()

    if (book.series.startsWith('Related to:')) {
      book.series = book.series.replace('Related to: ', '');
    }

    if (book.series.startsWith('Collects books from:')) {
      book.series = book.series.replace('Collects books from: ', '');
    }
  }
  return book;
}

/**
  * Converts Amazon dates (sometimes `2000 October 30`, sometimes `October 30, 2000`)
  * to consistent `2000-10-30` format.
  */
function fixAmazonDate(input?: string) {
  if (input === undefined) return undefined;
  if (input.indexOf(',') > 0) {
    return reformat(input, 'LLLL d, yyyy', 'yyyy-MM-dd');
  } else {
   return reformat(input, 'yyyy LLLL d', 'yyyy-MM-dd');
  }
}

/**
  * Strips out CDN scaling modifiers from Amazon image URLs
  */
function fixAmazonImage(input?: string) {
  if (input === undefined) return undefined;
  if (URL.canParse(input)) {
    return input.replace(/._[A-Z0-9_]+_.jpg/, '.jpg')
  }
  return undefined;
}

/**
 * Strips out unnamed creators and maps multiple creators and contributors to our
 * generalized role structure
 */
function fixAmazonCreator(input: { name?: string, url?: string, role?: string }[]) {
  const output: Record<string, string[]> = {};
  
  for (const c of input) {
    let role = c.role?.replaceAll(/[()]/g, '').toLocaleLowerCase().split(',').filter(r => !!r);
    role ??= ['author'];
    if (c.name !== 'undefined' && c.name?.trim().length) {
      for (const r of role) {
        output[r.trim()] ??= [];
        output[r.trim()].push(c.name.trim());  
      }
    }
  }

  return output;
}

export function applyMetadataPatterns(input: ParsedAmazonData, rules: Record<string, string[]> = {}): ParsedAmazonData {
  if (input.title === undefined) return input;
  
  for (const value of rules.imprints ?? []) {
    if (input.title.indexOf(wrap(value)) > 0) {
      input.title = input.title.replace(wrap(value), '').trim();
      input.imprint ??= value;
    }
  }
  for (const value of rules.publishers ?? []) {
    if (input.title.indexOf(wrap(value)) > 0) {
      input.title = input.title.replace(wrap(value), '').trim();
      input.publisher ??= value;
    }
  }
  for (const value of rules.series ?? []) {
    if (input.title.indexOf(wrap(value)) > 0) {
      input.title = input.title.replace(wrap(value), '').trim();
    } else {
      const regex = new RegExp(` \((${value}),? (Book|#)?(\d+)\)`);
      const [match, series, , seriesOrder] =
        regex.exec(input.title) ?? [];
      if (match) input.title = input.title.replace(match, '').trim();
      if (series || seriesOrder) {
        input.series = series.trim().length ? series.trim() : undefined,
        input.position = seriesOrder ? seriesOrder : undefined;
      }
    }
  }
  for (const value of rules.editions ?? []) {
    if (input.title.indexOf(wrap(value)) > 0) {
      input.title = input.title.replace(wrap(value), '').trim();
      input.edition ??= value;
    } else if (input.title.endsWith(', ' + value)) {
      input.title = input.title.replace(', ' + value, '').trim();
      input.edition ??= value;
    }
  }

  if (input.title.indexOf(': ') > 0) {
    const [title, subtitle] = input.title.split(': ');
    input.title = title.trim();
    input.subtitle = subtitle.trim();
  }

  return input;
}

function wrap(input: string, open = ' (', close = ')') {
  return open + input + close;
}
