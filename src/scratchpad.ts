import 'dotenv/config';
import { Fetcher } from './shared/fetcher.js'
import jetpack from '@eatonfyi/fs-jetpack';

const dir = jetpack.dir('/Users/jeff/Work')
const proxies = dir.read('all-proxies.txt')?.split('\n') ?? [];
const goodProxies = dir.createWriteStream('good-proxies.txt')

for (const p of proxies) {
  const f = new Fetcher({ proxies: [p] });
  const result = await f.fetcher.headers({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:42.0) Gecko/20100101 Firefox/42.0'
  }).get(`https://www.amazon.com/dp/0895770105`).text();
  if (result.match('<h4>Type the characters you see in this image:</h4>') === null) {
    console.log('GOOD: ' + p);
    goodProxies.write(p + '\n');
  } else {
    console.log('BAD: ' + p);
  }
}
