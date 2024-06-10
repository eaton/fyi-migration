import { nanohash } from '@eatonfyi/ids';
import { emptyDeep, merge } from 'obby';
import { Book, BookSchema } from '../schemas/book.js';
import { CreativeWork } from '../schemas/creative-work.js';
import { Fetcher, FetcherOptions } from '../shared/index.js';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';
import { NormalizedUrl } from '@eatonfyi/urls';
import { expandIds, getBestId } from './normalize-ids.js';
import * as parsers from './parsers/index.js';
import jetpack from '@eatonfyi/fs-jetpack';
import { parse as parsePath } from 'path';

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
  reParse: true
};

const PartialBookSchema = BookSchema.partial();

export class BookMigrator extends Fetcher {
  declare options: BookMigratorOptions;
  partialBooks: Partial<Book>[] = [];
  parsedBooks: Record<string, Book> = {};
  notes: Record<string, CreativeWork[]> = {};

  html: typeof jetpack;
  json: typeof jetpack;
  covers: typeof jetpack;

  parsableDomains: Record<string, (html: string) => Promise<Book>>;

  constructor(options: BookMigratorOptions = {}) {
    super({ ...defaults, ...options });

    this.html = this.cache.dir('html');
    this.json = this.cache.dir('json');
    this.covers = this.cache.dir('images');

    this.parsableDomains = {
      abookapart: parsers.abookapart,
      rosenfeldmedia: parsers.rosenfeldmedia,
      amazon: parsers.amazon
    }
  }

  override async cacheIsFilled() {
    if (!this.cache.exists('books.ndjson')) return false;
    if (!this.html.list()?.length) return false;
    if (!this.json.list()?.length) return false;
    if (!this.covers.list()?.length) return false;
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
    partialBooks = emptyDeep(partialBooks.map(b => this.populateIds(b))) as Partial<Book>[] ?? [];
    
    // Write a copy of the original book list; doesn't hurt.
    this.cache.write('books.ndjson', partialBooks);
    
    const htmlToParse = new Map<Partial<Book>, string | undefined>();

    // Populate the pool of cached HTML
    for (const book of partialBooks) {
      const url = this.getBookParseUrl(book);
      const cacheFile = `${nanohash(url)}.html`;
      if (!url) {
        this.log.error(`No parsable URL for ${book.id}`);
      } else if (this.html.exists(cacheFile) && !this.options.reFetch) {
        htmlToParse.set(book, cacheFile);
        this.log.debug(`Loaded cached HTML for ${url}`)
      } else {
        const html = await this.fetchBookHtml(url);
        if (html) {
          htmlToParse.set(book, cacheFile);
          this.html.write(cacheFile, html);
          this.log.debug(`Fetched HTML for ${book.id}`)
        } else {
          this.log.error(`Fetched empty HTML for ${book.id}`)
        }
      }
    }

    for (const [book, htmlFile] of htmlToParse.entries()) {
      const stringUrl = this.getBookParseUrl(book);
      const url = new NormalizedUrl(stringUrl!);
      const parser = this.parsableDomains[url.domainWithoutSuffix];
      if (htmlFile) {
        const html = this.html.read(htmlFile, 'utf8');
        if (html) {
          const parsedData = parser(html);
          const merged = BookSchema.parse(merge(parsedData, book));
          this.parsedBooks[merged.id] = merged;
          this.json.write(`${merged.id}.json`, merged);
        }
      }
    }

    for (const book of Object.values(this.parsedBooks)) {
      if (!this.covers.exists(this.getCoverFilename(book))) {
        await this.fetchBookCover(book);
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
    book.id = getBestId(book.ids);
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
      file = book.id + parsePath(book.image).ext?.toLocaleLowerCase().replace('jpeg', 'jpg') || '.jpg';
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
          if (html.match('<h4>Type the characters you see in this image:</h4>') === null) {
            this.log.debug(`Fetched ${url.toString()}`);
            return html;
          } else {
            this.log.debug(`Bad cache for ${url.toString()}`);
            // throw new Error('Bad cache');
          }
        });
  }
}

