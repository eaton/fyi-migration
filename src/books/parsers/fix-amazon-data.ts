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
    const [, order, ] = /Book (\d+) of (\d+)/.exec(carousel.series ?? '') ?? []
    book.series = carousel.series?.trim();
    book.position = order ? order : undefined;
  }

  book.publisher ??= carousel.publisher || info.publisher;
  book.date = fixAmazonDate(carousel.publication_date || info.publication_date);
  if (info.publication_date) book.publisher = book.publisher?.replace(' (' + info.publication_date + ')', '');
  
  const pages = carousel.ebook_pages || carousel.fiona_pages || info.ebook_pages || info.print_length;
  if (pages) {
    book.pages = Number.parseInt(pages);
  }

  // Title/Subtitle Splitting
  book = splitTitle(book);
  book = fixAmazonTitles(book);
  book = applyPatterns(book, patterns);
  return book;
}

function mapKeyValues(input: { key?: string, label?: string, value?: string }[]) {
  const entries = input.map(item => [(item.key ?? item.label)?.toLocaleLowerCase().replaceAll(/\s+/g, '_') ?? 'undefined', item.value]);
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

function applyPatterns(book: ParsedAmazonData, patterns: Record<string, string[]> = {}) {
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

  if (book.publisher) book.title = book.title.replace(`(${book.publisher})`, '').trim()
  if (book.series) {
    book.title = book.title?.replace(`(${book.series})`, '')
      .replace('(' + book.series + ')', '')
      .trim()
    }

  // Kindle Singles. JFC.
  if (book.title && book.title.indexOf('(Kindle Single)') > 0) {
  book.imprint ??= 'Kindle Singles';
  book.title = book.title?.replace('(Kindle Single)', '');
  }

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

  // Check for Editions in the title, whether duplicated or not
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

  // Known imprint mixups
  if (book.title && book.title.indexOf('A Tor.Com Original') > 0) {
    book.imprint = 'Tor.Com Originals';
    book.title = book.title?.replace('A Tor.Com Original', '').trim();
  }

  // If there's a colon in the title, split it and make the second half the subtitle.
  const [newTitle, newSubtitle] = book.title?.split(':', 2) ?? [];
  if (newTitle.trim() !== book.series) {
    if (book.subtitle === undefined || book.subtitle === newSubtitle?.trim()) {
      book.subtitle = newSubtitle?.trim();
      book.title = newTitle.trim();
    }
  }

  // There are a few of these out there. Might as well catch 'em.
  if (book.title?.endsWith(', The')) {
    book.title = 'The ' + book.title?.replace(', The', '');
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