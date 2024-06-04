import { nanohash } from '@eatonfyi/ids';
import { get, unflatten } from 'obby';
import { Book, BookSchema } from '../schemas/book.js';
import { CreativeWork } from '../schemas/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/index.js';
import { isString } from '../util/type-guards.js';
import { BookFetcher } from './book-fetcher.js';

export interface BookMigratorOptions extends MigratorOptions {
  customImages?: string;
}

const defaults: BookMigratorOptions = {
  input: 'input/books',
  cache: 'cache/books',
  output: 'src/books',
};

export class BookMigrator extends Migrator {
  declare options: BookMigratorOptions;
  books: Record<string, Book> = {};
  notes: Record<string, CreativeWork[]> = {};
  fetcher = new BookFetcher();

  constructor(options: BookMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async fillCache() {
    // First, read any '*.tsv' input files and attempt to parse them as pseudo-books.
    for (const f of this.input.find({ matching: '*.tsv' })) {
      const booklist = this.input.read(f, 'auto') as
        | Record<string, unknown>[]
        | undefined;
      if (booklist === undefined) continue;

      this.log.debug(booklist.length);
      const partialBooks = booklist
        .map(b => this.populatePartialBook(b))
        .filter(b => b !== undefined);
      this.log.debug(partialBooks.length);
    }
  }

  protected async populatePartialBook(input: Record<string, unknown>) {
    // 1. Get the first ID from the ids list.
    // 2. If there isn't an ID, check for a URL and check for its cached HTML.
    //    a. If there's cached HTML, parse it.
    //    b. If there's not, check if the URL is retrievable.
    //    c. If it isn't, bail out with an error.
    //    d. If it is, retrieve the HTML and cache it.
    // 3. If there is an ID, check for cached JSON.
    //    a. If there isn't, construct a URL and attempt step 2a-2b.
    //    b. If no HTML can be retrieved, bail with an error.
    //    c. If HTML can be retrieved, parse out the JSON.
    //    d. Cache the Book JSON, and hold onto it for safe keeping.
    // 4. If the retrieveImages option is TRUE, check whether a cached image exists for the id.
    //    a. If none exists, and an image property is populated, fetch and cache it.
    // 5. Return the Book JSON

    const parsed = BookSchema.optional().safeParse(unflatten(input));
    if (parsed.error) {
      this.log.error(parsed.error.message);
      return;
    } else if (parsed.data === undefined) {
      this.log.error('Empty book parsed');
      return;
    }
    const pb = parsed.data;
    pb.id = this.getCanonicalId(pb);

    return pb;
  }

  protected getCanonicalId(input: Record<string, unknown>) {
    if (isString(input.id)) return input.id;
    if (input.ids) {
      const id = get(input.ids, 'custom isbn10 isbn13 asin upc');
      if (isString(id)) {
        return id;
      }
    }
    return nanohash(input);
  }
}
