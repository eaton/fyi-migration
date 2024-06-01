import jetpack from '@eatonfyi/fs-jetpack';
import { Fetcher, FetcherOptions } from '../util/fetcher.js';

export class BookFetcher extends Fetcher {
  // Cache subdirectories
  html: typeof jetpack;
  json: typeof jetpack;
  images: typeof jetpack;

  constructor(options: FetcherOptions = {}) {
    super(options);

    // Set up our sub-cache directories
    this.cache = this.cache.dir('books');
    this.html = this.cache.dir('html');
    this.json = this.cache.dir('json');
    this.images = this.cache.dir('covers');

    // Set to the correct output directory
    this.output = this.output.dir('books');
  }
}
