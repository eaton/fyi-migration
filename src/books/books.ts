import jetpack from '@eatonfyi/fs-jetpack';
import { nanohash } from '@eatonfyi/ids';
import { NormalizedUrl } from '@eatonfyi/urls';
import { emptyDeep, merge } from 'obby';
import { parse as parsePath } from 'path';
import { Book, BookSchema } from '../schemas/book.js';
import { CreativeWork } from '../schemas/creative-work.js';
import { Fetcher, FetcherOptions } from '../shared/index.js';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';
import { expandIds, getBestId } from './normalize-ids.js';
import * as parsers from './parsers/index.js';
import { z } from 'zod';

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
  concurrency: 1,
  reParse: true,
};

const PartialBookSchema = BookSchema.partial();

export class BookMigrator extends Fetcher {
  declare options: BookMigratorOptions;
  parsedBooks: Record<string, Book> = {};
  customBooks: Record<string, Book> = {};
  notes: Record<string, CreativeWork[]> = {};
  patterns: Record<string, string[]> = {};

  html: typeof jetpack;
  json: typeof jetpack;
  covers: typeof jetpack;

  parsableDomains: Record<string, (html: string, patterns?: Record<string, string[]>) => Promise<Book | undefined>>;

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
    if (!this.cache.exists('books.ndjson')) return false;
    if (!this.html.list()?.length) return false;
    if (!this.json.list()?.length) return false;
    if (!this.covers.list()?.length) return false;
    return false;
  }

  override async fillCache() {
    let partialBooks: z.infer<typeof PartialBookSchema>[] = [];

    // Try the google doc first, if it's not available check for a CSV file in the input directory.
    if (this.options.documentId) {
      partialBooks = await fetchGoogleSheet(
        this.options.documentId,
        this.options.sheetName,
        PartialBookSchema,
      );

      const helperSchema = z.object({ name: z.string() });
      for (const sh of ['imprints', 'publishers', 'editions', 'series']) {
        const data = await fetchGoogleSheet(this.options.documentId, sh, helperSchema);
        this.patterns[sh] = data.map(d => d.name);
      }

    } else if (this.input.exists('books.csv')) {
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
    } else {
      this.log.error('No book list found');
      return;
    }

    // The raw BookList is sparse: it only includes basic identification information
    // for each book, *and* overrides for properties that are known to be borked
    // in the data we parse from Amazon's APIs.
    partialBooks = partialBooks.map(b => this.populateIds(b));

    // Write a copy of the original book list; doesn't hurt.
    this.cache.write('books.ndjson', partialBooks);
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
            this.log.debug(`Fetched HTML for ${book.id}`);
          } else {
            this.log.error(`Fetched empty HTML for ${book.id}`);
          }
        } else {
          this.log.error(`No cache, no URL for ${book.id}`);
        }
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
            this.log.error(`Empty parsed data for ${book.url}`);
          } else {
            const merged = this.populateIds(merge(parsedData, emptyDeep(book)) as Partial<Book>);
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

    const allBooksToProcess = merge(this.parsedBooks, this.customBooks);
    this.cache.write('parsed-books.ndjson', Object.values(allBooksToProcess));
    
    for (const book of Object.values(this.parsedBooks)) {
      if (!this.covers.exists(this.getCoverFilename(book))) {
        await this.fetchBookCover(book);
      }
    }

    const customCoverDir = this.input.dir('images');
    for (const cover of customCoverDir.list() ?? []) {
      jetpack.copy(customCoverDir.path(cover), this.covers.path(cover), { overwrite: true });
    }

    return;
  }

  override async readCache(): Promise<unknown> {
    if (Object.values(this.parsedBooks).length === 0) {
      const data = this.cache.read('parsed-books.ndjson', 'auto') as Book[] || undefined;
      for (const b of data) {
        this.parsedBooks[b.id] = b;
      }  
    }
    return this.parsedBooks;
  }

  protected getBookParseUrl(book: Partial<Book>) {
    let url: NormalizedUrl | undefined = undefined;
    if (book.url) {
      url = new NormalizedUrl(book.url);
    }
    if (!url || !this.parsableDomains[url.domainWithoutSuffix]) {
      const urlId = book.ids?.asin ?? book.ids?.isbn10;
      if (urlId && book.url === undefined) {
        url = new NormalizedUrl(
          `https://amazon.com/dp/${urlId}`,
        );
      }
    }
    return url?.toString();
  }

  protected populateIds(book: Partial<Book>) {
    book.ids = expandIds(book.ids);
    const bestId = getBestId(book.ids);
    if (bestId) book.id = bestId;
    return book;
  }

  protected async fetchBookCover(book: Book) {
    const file = this.getCoverFilename(book);
    if (book.image && file) {
      return this.covers.downloadAsync(file, book.image);
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
          // throw new Error('Bad cache');
        }
      });
  }
}
