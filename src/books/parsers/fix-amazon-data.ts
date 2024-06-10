const carousel = Object.fromEntries(parsed.data.carousel.filter(Boolean)
.map(item => [item.key ?? 'none', { label: item.label, value: item.value }])
);

let rawBook: Partial<Book> = {
_key: parsed.data.asin,
id: {
  asin: parsed.data.asin,
  isbn10: carousel.isbn10?.value?.replaceAll('-', ''),
  isbn13: carousel.isbn13?.value?.replaceAll('-', '')
},
creator: z.array(CreatorSchema).parse(
  (parsed.data.book.creator ?? []).map(c => fixAmazonCreator(c))
),
url: 'https://www.amazon.com/dp/' + parsed.data.asin,
title: parsed.data.title?.trim(),
image: fixAmazonImage(parsed.data.image?.hires ?? parsed.data.image?.src),
format: parsed.data.book.format?.trim(),
publisher: carousel.publisher?.value?.trim(),
edition: carousel.edition?.value?.trim(),
}

if (carousel.fiona_pages?.value) {
rawBook.pages = Number.parseInt(carousel.fiona_pages.value.trim().replace(' pages', ''));
}

if (carousel.dimensions?.value) {
const [all, width, length, height] = /([\d\.]+) x ([\d\.]+) x ([\d\.]+)/.exec(carousel.dimensions?.value) ?? []; // 5.5 x 0.32 x 8.25
const dimensions = DimensionSchema.safeParse({ width, length, height });
if (dimensions.success) {
  rawBook.dimensions = dimensions.data;
}
}

const weight = parsed.data.details?.find(d => d.label?.toLocaleLowerCase() === 'item weight')?.value;
if (weight && rawBook.dimensions) {
rawBook.dimensions.weight = weight;
}

if (carousel.publication_date?.value) {
rawBook.date = { published: fixAmazonDate(carousel.publication_date?.value) };
}

if (carousel.series?.value) {
const [label, order, total] = /Book (\d+) of (\d+)/.exec(carousel.series.label ?? '') ?? []
rawBook.series = {
  name: carousel.series.value?.trim(),
  order: order ? Number.parseInt(order) : undefined,
  total: total ? Number.parseInt(total) : undefined
}
}

// Title/Subtitle Splitting
rawBook = splitTitle(rawBook);

// 
rawBook = fixAmazonTitles(rawBook);

return BookSchema.safeParse(rawBook);
}

// Attempts to detect common title/subtitle scenarios with colons and em dashes as separators.
// The complicating factor is detecting odd scenarios where a series name prefixes an otherwise
// bland title, or the colon an actual part of the title's text.
function splitTitle(book: Partial<Book>) {
if (book.title) {
const [title, subtitle] = book.title.split(/[:–]/, 2);
if (subtitle) {
  if (similar(title, book.series?.name) && (book.series?.order !== 1)) {
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

function fixMetaDuplicatedInTitle(book: Partial<Book>) {
if (!book.title) return book;
const matches = book.title.matchAll(/\s*([\(\[](.+)[\)\]])\s*/g);

for (let [match, segment] of matches) {
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

function isCurEdition(input: string, book: Partial<Book>) {
if (!input) return false;
if (similar(input, book.edition)) return true;
}

function isCurSeries(input: string, book: Partial<Book>) {
if (!input) return false;
if (similar(input, book.series?.name)) return true;
if (similar(input, Object.values(book.series ?? {}).join())) return true;
}

function isCurPublisher(input: string, book: Partial<Book>) {
if (!input) return false;
if (similar(input, book.publisher)) return true;
}

function isCurImprint(input: string, book: Partial<Book>) {
if (!input) return false;
if (similar(input, book.imprint)) return true;
}

function isCurSubtitle(input: string, book: Partial<Book>) {
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
o = o.replaceAll(/[\s-_\(\)\[\]\.]/g, '');
o = o.toLocaleLowerCase();
return o;
}
}

function fixAmazonTitles(book: Partial<Book>) {
if (book.title === undefined) return book;
if (book.subtitle?.length === 0) book.subtitle = undefined;

if (book.publisher) book.title = book.title.replace(`(${book.publisher})`, '').trim()
if (book.series?.name) {
book.title = book.title
  .replace(`(${book.series.name})`, '')
  .replace('(' + book.series.name + ')', '')
  .trim()
}

// Kindle Singles. JFC.
if (book.title.indexOf('(Kindle Single)') > 0) {
book.imprint ??= 'Kindle Singles';
book.title = book.title.replace('(Kindle Single)', '');
}

const [nssMatch, nssName, nssNumString, nssSep, nssNum] = book.title.match(/\((.+?)(,? ?(no|no\.|#|book|vol|volume)? ?(\d+))\)/i) ?? [];
if (nssMatch) {
book.series ??= {};
book.series.name ??= nssName.trim();
if (nssNum) book.series.order ??= Number.parseInt(nssNum);
book.title = book.title.replace(nssMatch, '').trim();
}

const [
seriesMatch, seriesString, seriesName, seriesSignifier, separator, orderString, orderName, orderNum
] = /\((([\s\w]+) +(series|duology|trilogy|quintet|sextet|sequence|cycle|saga|collection|novel)?(\s*)),? ?((book|no\.|\#)? ?([\d+])?)\)/i.exec(book.title) ?? [];
if (seriesMatch) {
book.series ??= {};
book.title = book.title.replace(seriesMatch, '').trim();
if (book.series.name === seriesName || book.series.name === seriesString) {
} else {
  book.series.name ??= seriesString.replace(', ', '').trim();
  if (orderNum) {
    book.series.order ??= Number.parseInt(orderNum);
  }
}
}

// A common pattern for imprints…
const [impMatch, impName, impTag] = book.title.match(/\((.+ (classics|library))\)/i) ?? [];
if (impMatch) {
book.imprint ??= [impName.trim(), impTag.trim()].join(' ');
book.title = book.title.replace(impMatch, '').trim();
}

// Check for Editions in the title, whether duplicated or not
const [editionMatch, editionString, edition, annotation] = / *\((([\s\w]+) +(ed|ed\.|Edition))\)/i.exec(book.title) ?? [];
if (editionMatch) {
if (book.edition === undefined) {
  book.edition = edition + ' Edition';
} else if (book.edition === editionString || book.edition === edition) {
  // do nothing
} else {
  // we might want to check on this
}
book.title = book.title.replace(editionMatch, '').trim();
}

// Known imprint mixups
if (book.title.indexOf('A Tor.Com Original') > 0) {
book.imprint = 'Tor.Com Originals';
book.title = book.title.replace('A Tor.Com Original', '').trim();
}

// If there's a colon in the title, split it and make the second half the subtitle.
const [newTitle, newSubtitle] = book.title.split(':', 2);
if (newTitle.trim() !== book.series?.name) {
if (book.subtitle === undefined || book.subtitle === newSubtitle?.trim()) {
  book.subtitle = newSubtitle?.trim();
  book.title = newTitle.trim();
}
}

// There are a few of these out there. Might as well catch 'em.
if (book.title.endsWith(', The')) {
book.title = 'The ' + book.title.replace(', The', '');
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
return Dates.reformat(input, 'LLLL d, yyyy', 'yyyy-MM-dd');
} else {
return Dates.reformat(input, 'yyyy LLLL d', 'yyyy-MM-dd');
}
}

/**
* Strips out CDN caling modifiers from Amazon image URLs
*/
function fixAmazonImage(input?: string) {
if (input === undefined) return undefined;
if (URL.canParse(input)) {
return input.replace(/._[A-Z0-9_]+_.jpg/, '.jpg')
}
return undefined;
}

function fixAmazonCreator(input: { name?: string, url?: string, role?: string }) {
if (input.name === undefined || input.name.trim().length === 0) {
return undefined;
}

if (input.role) {
input.role = input.role.split(',')[0].replaceAll(/[(),]/g, '').toLocaleLowerCase().trim();
}

if (input.url) {
if (ParsedUrl.canParse(input.url, 'https://www.amazon.com/')) {
  const url = new ParsedUrl(input.url, 'https://www.amazon.com/');
  url.search = '';
  if (url.pathname.startsWith('/s/')) {
    input.url = undefined;
  } else {
    input.url = url.href;
  }
} else {
  input.url = undefined;
}
}

const parsed = CreatorSchema.safeParse(input);
if (parsed.success) return parsed.data;
return undefined;
}