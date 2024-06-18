import jetpack from '@eatonfyi/fs-jetpack';
import { nanohash } from '@eatonfyi/ids';
import { NormalizedUrl } from '@eatonfyi/urls';
import { emptyDeep, merge, set } from 'obby';
import { parse as parsePath } from 'path';
import { z } from 'zod';
import {
  BookSchema,
  PartialBookSchema,
  type Book,
  type PartialBook,
} from '../schemas/book.js';
import { Fetcher, FetcherOptions } from '../shared/index.js';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';
import { expandIds, getBestId } from './normalize-ids.js';
import * as parsers from './parsers/index.js';

export interface BookMigratorOptions extends FetcherOptions {
  documentId?: string;
  sheetName?: string;
  reFetch?: boolean;
  reParse?: boolean;
}

const defaults: BookMigratorOptions = {
  input: 'input/books',
  cache: 'cache/books',
  output: 'src/books',
  documentId: process.env.GOOGLE_SHEET_LIBRARY,
  sheetName: 'books',
};

export class BookMigrator extends Fetcher {
  declare options: BookMigratorOptions;
  bookData: Record<string, Book> = {};

  parsedBooks: Record<string, Book> = {};
  customBooks: Record<string, Book> = {};
  skippedBooks: Record<string, Book> = {};

  notes: Record<string, string> = {};
  patterns: Record<string, string[]> = {};

  html: typeof jetpack;
  json: typeof jetpack;
  covers: typeof jetpack;

  parsableDomains: Record<
    string,
    (
      html: string,
      patterns?: Record<string, string[]>,
    ) => Promise<Book | undefined>
  >;

  constructor(options: BookMigratorOptions = {}) {
    super({ ...defaults, ...options });

    this.html = this.cache.dir('html');
    this.json = this.cache.dir('json');
    this.covers = this.cache.dir('images');

    this.parsableDomains = {
      abookapart: parsers.abookapart,
      rosenfeldmedia: parsers.rosenfeldmedia,
      amazon: parsers.amazon,
    };
  }

  override async cacheIsFilled() {
    if (!this.cache.exists('book-list.ndjson')) return false;
    if (!this.cache.exists('book-data.ndjson')) return false;
    if (!this.html.list()?.length) return false;
    if (!this.json.list()?.length) return false;
    if (!this.covers.list()?.length) return false;
    return true;
  }

  override async fillCache() {
    let partialBooks: PartialBook[] = [];

    // Try the google doc first, if it's not available check for a CSV file in the input directory.
    if (this.input.exists('books.csv')) {
      const raw =
        (this.input.read('books.csv', 'auto') as
          | Record<string, unknown>[]
          | undefined) ?? [];
      partialBooks = raw.map(r => PartialBookSchema.parse(r));

      for (const sh of ['imprints', 'publishers', 'editions', 'series']) {
        if (this.input.exists(sh + '.txt')) {
          const data = this.input.read(sh + '.txt', 'utf8');
          if (data) {
            this.patterns[sh] = data.split('\n');
          }
        }
      }
    } else if (this.options.documentId) {
      partialBooks = await fetchGoogleSheet(
        this.options.documentId,
        this.options.sheetName,
        PartialBookSchema,
        true
      );

      const helperSchema = z.object({ name: z.string() });
      for (const sh of ['imprints', 'publishers', 'editions', 'series']) {
        const data = await fetchGoogleSheet(
          this.options.documentId,
          sh,
          helperSchema,
          true
        );
        this.patterns[sh] = data.map(d => d.name);
      }
    } else {
      this.log.error('No book list found');
      return;
    }

    // The raw BookList is sparse: it only includes basic identification information
    // for each book, *and* overrides for properties that are known to be borked
    // in the data we parse from Amazon's APIs.
    partialBooks = partialBooks.map(b => this.populateIds(b));

    // Write a copy of the original book list; doesn't hurt.
    this.cache.write('book-list.ndjson', partialBooks);
    this.cache.write('patterns.json', this.patterns);

    // Stores HTML file paths, not actual HTML body
    const htmlToParse = new Map<Partial<Book>, string | undefined>();

    // Populate the pool of cached HTML
    for (const book of partialBooks) {
      if (book.ids?.custom) {
        this.customBooks[book.ids.custom] = BookSchema.parse(book);
      } else {
        const url = this.getBookParseUrl(book);
        const cacheFile = `${nanohash(url)}.html`;

        if (this.html.exists(cacheFile) && !this.options.reFetch) {
          htmlToParse.set(book, cacheFile);
        } else if (url) {
          const html = await this.fetchBookHtml(url);
          if (html) {
            htmlToParse.set(book, cacheFile);
            this.html.write(cacheFile, html);
            this.log.debug(`Fetched HTML for ${url}`);
          } else {
            this.log.error(`Fetched empty HTML for ${url}`);
          }
        } else {
          this.log.error(`No cache, no URL for ${book.id}`);
        }
      }

      // Tuck any notes away for later.
      if (book.note && book.id && typeof book.note === 'string') {
        this.notes[book.id] = book.note;
      }
    }

    for (const [book, htmlFile] of htmlToParse.entries()) {
      const stringUrl = this.getBookParseUrl(book);
      const url = new NormalizedUrl(stringUrl!);
      const parser = this.parsableDomains[url.domainWithoutSuffix];
      if (parser && htmlFile) {
        const html = this.html.read(htmlFile, 'utf8');
        if (html) {
          const parsedData = await parser(html, this.patterns);
          if (!parsedData) {
            this.log.error(`Empty parsed data for ${htmlFile}`);
          } else {
            const merged = this.populateIds(
              merge(parsedData, emptyDeep(book)) as Partial<Book>,
            );
            if (merged.creator) set(merged, 'creator', deDuplicateCreators(merged.creator));

            const final = BookSchema.parse(merged);

            if (final.id.length < 10) {
              this.log.debug(`Generated short ISBN ${merged.id}`);
            }
            this.parsedBooks[final.id] = final;
            this.json.write(`${merged.id}.json`, final);
          }
        } else {
          this.log.debug(`Empty HTML for ${book.id}`);
        }
      } else {
        this.log.debug(`Parser or HTML missing for ${book.id}`);
      }
    }

    this.bookData = merge(this.parsedBooks, this.customBooks) as Record<
      string,
      Book
    >;
    this.cache.write('book-data.ndjson', Object.values(this.bookData));

    if (Object.values(this.notes).length) {
      this.cache.write('book-notes.json', this.notes);
    }

    for (const book of Object.values(this.bookData)) {
      if (!this.covers.exists(this.getCoverFilename(book))) {
        book.image = await this.fetchBookCover(book);
      }
    }

    const customCoverDir = this.input.dir('images');
    for (const cover of customCoverDir.list() ?? []) {
      jetpack.copy(customCoverDir.path(cover), this.covers.path(cover), {
        overwrite: true,
      });
    }

    return;
  }

  override async readCache(): Promise<unknown> {
    if (Object.values(this.bookData).length === 0) {
      const data = this.cache.read('book-data.ndjson', 'auto');
      if (Array.isArray(data)) {
        const ba = data.map(b => BookSchema.parse(b));
        this.bookData = Object.fromEntries(ba.map(b => [b.id, b]));
      }
    }
    return this.bookData;
  }

  override async finalize(): Promise<unknown> {
    this.cache.copy(
      'book-data.ndjson',
      this.root.path('src/_data/books.ndjson'),
      { overwrite: true },
    );

    const books = Object.values(this.bookData);
    await this.saveThings(books)


    this.copyAssets(this.cache.path('images'), 'books');

    // Finally, we're going to spit out a CSV version of the original book index,
    // for our own purposes. NOTE that this currently truncates creator lists and
    // appears to hicup on certain overlaps. We need a better way to round-trip
    // the information.
    const flattened = Object.values(this.bookData).map(makeFlattenedBook);
    this.cache.write('replacement-book-list.csv', flattened);
    return;
  }

  protected getBookParseUrl(book: Partial<Book>) {
    let url: NormalizedUrl | undefined = undefined;
    if (book.url) {
      url = new NormalizedUrl(book.url);
    }
    if (!url || !this.parsableDomains[url.domainWithoutSuffix]) {
      const urlId = book.ids?.asin ?? book.ids?.isbn10;
      if (urlId && book.url === undefined) {
        url = new NormalizedUrl(`https://www.amazon.com/dp/${urlId}`);
      }
    }
    return url?.toString();
  }

  protected populateIds(book: Partial<Book>) {
    book.ids = expandIds(book.ids ?? {});
    const bestId = getBestId(book.ids);
    if (bestId) book.id = bestId;
    return book;
  }

  protected async fetchBookCover(book: Book) {
    const file = this.getCoverFilename(book);
    if (book.image && file) {
      await this.covers.downloadAsync(file, book.image);
      return file;
    }
    return;
  }

  protected getCoverFilename(book: Book) {
    let file = book.id + '.jpg';
    if (book.image) {
      file =
        book.id +
          parsePath(book.image)
            .ext?.toLocaleLowerCase()
            .replace('jpeg', 'jpg') || '.jpg';
    }
    return file;
  }

  async fetchBookHtml(input?: string | URL) {
    if (input === undefined) return '';
    const url = new NormalizedUrl(input);
    return await this.fetcher
      .get(url.toString())
      .notFound(() => '404: ' + url.href)
      .forbidden(() => '403: ' + url.href)
      .text()
      .then(html => {
        // Detect Amazon.com
        if (
          html.match('<h4>Type the characters you see in this image:</h4>') ===
          null
        ) {
          this.log.debug(`Fetched ${url.toString()}`);
          return html;
        } else {
          this.log.debug(`Bad cache for ${url.toString()}`);
        }
      });
  }
}

function makeFlattenedBook(book: Book) {
  return {
    id: '',
    category: book.category,
    'ids.isbn10': book.ids?.isbn10,
    'ids.isbn13': book.ids?.isbn13,
    'ids.asin': book.ids?.asin,
    'ids.upc': book.ids?.upc,
    'ids.ddc': book.ids?.ddc,
    'ids.loc': book.ids?.loc,
    'ids.custom': book.ids?.custom,
    name: book.name,
    subtitle: book.subtitle,
    series: book.series,
    position: book.position,
    publisher: book.publisher,
    imprint: book.imprint,
    edition: book.edition,
    owned: book.owned,
    source: book.source,
    note: '',
    'dates.copyright': book.dates?.copyright?.toISOString()?.split('T')[0],
    'dates.publish': book.dates?.publish?.toISOString()?.split('T')[0],
    'dates.obtained': book.dates?.obtained?.toISOString()?.split('T')[0],
    'dates.read': book.dates?.read?.toISOString()?.split('T')[0],
    format: book.format,
    pages: book.pages,
    dimensions: [
      book?.dimensions?.width,
      book?.dimensions?.height,
      book?.dimensions?.depth,
    ]
      .filter(d => d !== undefined)
      .join('x'),
    url: book.url,
    image: book.image,
    ...getSimpleCreatorList(book)
  };

  function getSimpleCreatorList(book: Book) {
    const output: Record<string, string | undefined> = {
      'creator.author.0': undefined,
      'creator.editor.0': undefined,
      'creator.illustrator.0': undefined,
      'creator.foreword.0': undefined,
    };
    for (const [role, contributors] of Object.entries(book.creator ?? {})) {
      const name = (typeof contributors === 'string') ? contributors : contributors[0];
      if (['author', 'editor', 'illustrator', 'foreword'].includes(role) && name) {
        output['creator.' + role + '.0'] = name;
      }
    }
    return output;
  }
}

function deDuplicateCreators(input: string | string[] | Record<string, string | string[]>) {
  if (typeof input === 'string') {
    return input;
  } else if (Array.isArray(input)) {
    return [...new Set<string>(input).values()];
  } else {
    // Loop through each key and deduplicate THEM
    for (const [key, values] of Object.entries(input)) {
      input[key] = deDuplicateCreators(values) as string | string[];
    }
    return input;
  }
}
