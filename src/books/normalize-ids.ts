import { asin, isbn } from '@eatonfyi/ids';
import { emptyDeep, get } from 'obby';

type IdList = Record<string, string>;

export function getBestId(input?: IdList): string | undefined {
  if (input === undefined) return undefined;
  const found = get(input, 'custom isbn10 isbn13 asin *');
  return typeof found === 'string' ? found : undefined;
}

export function expandIds(input?: IdList): IdList {
  if (input === undefined) return {};

  if (input.isbn10) {
    input.isbn10 = input.isbn10.replaceAll('-', '').padStart(10, '0');
  }

  if (input.isbn13) {
    input.isbn13 = input.isbn13.replaceAll('-', '');
  }

  input = expandISBNs(input);
  input = isbnFromAsin(input);
  input = expandISBNs(input);

  return emptyDeep(input) ?? {};
}

export function isbnFromAsin(input: IdList): IdList {
  if (input.asin && isbn(input.asin)?.isIsbn10) {
    const i10 = isbn(input.asin)?.isbn10;
    if (i10) {
      input.isbn10 = i10;
      delete input.asin;
    }
  }
  return input;
}

export function expandISBNs(input: IdList): IdList {
  if (input.isbn10 && (!input.isbn13 || !isbn.isbn13(input.isbn13))) {
    const i13 = isbn(input.isbn10)?.isbn13;
    if (i13) input.isbn13 = i13;
  } else if (input.isbn13 && (!input.isbn10 || !isbn.isbn10(input.isbn10))) {
    const i10 = isbn(input.isbn13)?.isbn10;
    if (i10) input.isbn10 = i10;
  }

  if (input.isbn10) input.isbn10.padStart(10, '0');
  if (input.asin && asin.isIsbn10(input.asin))
    input.asin = input.asin.padStart(10, '0');
  return input;
}
