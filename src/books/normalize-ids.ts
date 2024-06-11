import { asin, isbn } from '@eatonfyi/ids';
import { get } from 'obby';

type IdList = Record<string, string | undefined>;

export function getBestId(input?: IdList): string | undefined {
  if (input === undefined) return undefined;
  const found = get(input, 'custom isbn10 isbn13 asin *');
  return typeof found === 'string' ? found : undefined;
}

export function expandIds(input?: IdList): IdList {
  if (input === undefined) return {};
  input = expandISBNs(input);
  input = isbnFromAsin(input);
  input = expandISBNs(input);
  return input;
}

export function isbnFromAsin(input: IdList): IdList {
  if (input.asin && isbn(input.asin)?.isIsbn10) {
    input.isbn10 = isbn(input.asin)?.isbn10?.padStart(10, '0');
  }
  return input;
}

export function expandISBNs(input: IdList): IdList {
  if (input.isbn10 && (!input.isbn13 || !isbn.isbn13(input.isbn13))) {
    input.isbn13 = isbn(input.isbn10)?.isbn13;
  } else if (input.isbn13 && (!input.isbn10 || !isbn.isbn10(input.isbn10))) {
    input.isbn10 = isbn(input.isbn13)?.isbn10;
  }

  if (input.isbn10) input.isbn10.padStart(10, '0');
  if (input.asin && asin.isIsbn10(input.asin)) input.asin = input.asin.padStart(10, '0');
  return input;
}
