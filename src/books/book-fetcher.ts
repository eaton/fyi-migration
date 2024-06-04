import jetpack from '@eatonfyi/fs-jetpack';
import { ParsedUrl } from '@eatonfyi/urls';
import { Fetcher, FetcherOptions } from '../shared/fetcher.js';

export interface BookFetcherOptions extends FetcherOptions {
  name: 'books';
  label: 'Book data fetching and sanitizing';
  cache: 'cache/books';
}

export class BookFetcher extends Fetcher {
  // Cache subdirectories
  html: typeof jetpack;
  json: typeof jetpack;
  covers: typeof jetpack;

  constructor(options: FetcherOptions = {}) {
    super(options);

    // Set up our sub-cache directories
    this._cache = this.cache.dir('books');
    this.html = this.cache.dir('html');
    this.json = this.cache.dir('json');
    this.covers = this.cache.dir('covers');
  }

  async getBookData(input: string | URL) {
    const url = new ParsedUrl(input);
  }
}
