import jetpack from '@eatonfyi/fs-jetpack';
import 'dotenv/config';
import * as parsers from './books/parsers/index.js';

const dir = jetpack.dir('/Volumes/migration/cache/books/html');

const amazon = await parsers.amazon(dir.read('acDCNqvL.html', 'utf8') ?? '');
const rosenfeld = await parsers.rosenfeldmedia(
  dir.read('eD0DKVBB.html', 'utf8') ?? '',
);
const abookapart = await parsers.abookapart(
  dir.read('aM1d_YsD.html', 'utf8') ?? '',
);

console.log(abookapart, rosenfeld, amazon);
