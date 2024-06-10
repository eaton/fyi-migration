import { nanohash } from '@eatonfyi/ids';
import { clone, emptyDeep } from 'obby';
import { Book, BookSchema } from '../schemas/book.js';
import { CreativeWork } from '../schemas/creative-work.js';
import { Fetcher, FetcherOptions } from '../shared/index.js';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';
import { NormalizedUrl } from '@eatonfyi/urls';
import { expandIds } from './normalize-ids.js';

export interface BookMigratorOptions extends FetcherOptions {
  documentId?: string;
  sheetName?: string;
}

const defaults: BookMigratorOptions = {
  input: 'input/books',
  cache: 'cache/books',
  output: 'src/books',
  documentId: process.env.GOOGLE_SHEET_LIBRARY,
  sheetName: 'books',
  concurrency: 1
};

const PartialBookSchema = BookSchema.partial();

export class BookMigrator extends Fetcher {
  declare options: BookMigratorOptions;
  partialBooks: Partial<Book>[] = [];
  cachedBooks: Record<string, Book> = {};
  notes: Record<string, CreativeWork[]> = {};

  parsableDomains: Record<string, (html: string) => Partial<Book>> = {}

  constructor(options: BookMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    if (!this.cache.exists('books.ndjson')) return false;
    if (!this.cache.list('html')?.length) return false;
    if (!this.cache.list('data')?.length) return false;
    if (!this.cache.list('covers')?.length) return false;
    return true;
  }

  override async fillCache() {
    let partialBooks: Partial<Book>[] = [];

    // Try the google doc first, if it's not available check for a CSV file in the input directory.
    if (this.options.documentId) {
      partialBooks = await fetchGoogleSheet(this.options.documentId, this.options.sheetName, PartialBookSchema);
    } else if (this.input.exists('books.csv')) {
      const raw = this.input.read('books.csv', 'auto') as Record<string, unknown>[] | undefined ?? [];
      partialBooks = raw.map(r => PartialBookSchema.parse(r));
    } else {
      this.log.error('No book list found');
      return;
    }

    // The raw BookList is sparse: it only includes basic identification information
    // for each book, *and* overrides for properties that are known to be borked
    // in the data we parse from Amazon's APIs.

    partialBooks = emptyDeep(partialBooks.map(b => this.populateIds(b))) ?? [];
    
    // Write a copy of the original book list; doesn't hurt.
    this.cache.write('books.ndjson', partialBooks);

    const notes = partialBooks.filter(b => b.notes).map(b => ({ id: b.id, text: b.note }));
    if (notes.length) {
      this.cache.write('notes.ndjson', notes);
    }
    
    // Now we populate the HTML cache
    for (const book of partialBooks) {
      const url = this.getBookParseUrl(book)
      if (url) {
        await this.fetchBookPage(book.url);
      }
    }

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
        url = new NormalizedUrl(`https://amazon.com/dp/${urlId.padStart(10, '0')}`);
      }  
    }
    return url?.toString();
  }
  
  protected populateIds(book: Partial<Book>) {
    book.ids = expandIds(book.ids);
    return book;
  }

  protected async processBook(input: Partial<Book>) {
    const book = clone(input);
    let fetched: Partial<Book> | undefined = undefined;

    fetched = book;

    // Merge any original inputs back in and run them through for good measure.
    const parsed = BookSchema.safeParse(fetched);
    if (parsed.success) return parsed.data;
    this.log.debug(parsed.error, `Could not parse ${book.url}`);
  }

  async fetchBookPage(input?: string | URL, force = false) {
    if (input === undefined) return '';
    const url = new NormalizedUrl(input);
    const hash = nanohash(url.href);
    if (this.cache.exists(`html/${hash}.html`) && !force) {
      return this.cache.read(`html/${hash}.html`, 'utf8') ?? '';
    } else {
      return await this.fetcher
        .get(url.toString())
        .notFound(() => url.href)
        .text()
        .then(html => {
          if (html.match('<h4>Type the characters you see in this image:</h4>') === null) {
            this.log.debug(`Fetched ${url.toString()}`);
            this.cache.write(`html/${hash}.html`, html);
            return html;
          } else {
            // this.log.debug(`Bad cache for ${url.toString()}`);
            // throw new Error('Bad cache');
          }
        });
    }
  }
}

