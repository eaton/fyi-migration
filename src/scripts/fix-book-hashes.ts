import jetpack from '@eatonfyi/fs-jetpack';
import { toCheerio } from '@eatonfyi/html';
import { asin, nanohash } from '@eatonfyi/ids';

const old = jetpack.dir(
  '/Volumes/migration/@home/data/cache/books/html-backup',
);
const htmlDir = jetpack.dir('/Volumes/migration/@home/data/cache/books/html');

for (const f of old.find({ matching: '*.html' })) {
  const html = old.read(f) ?? '';

  if (html) {
    const $ = toCheerio(html);
    const link = $("link[rel='canonical']").attr('href');
    if (link !== undefined) {
      const asinFromLink = asin.fromURL(link);
      if (asinFromLink) {
        const shortLink = asin.format(asinFromLink, 'url');
        if (shortLink) {
          const outfile = nanohash(shortLink) + '.html';
          if (!htmlDir.exists(outfile)) {
            htmlDir.write(outfile, html);
            htmlDir.append('log.txt', `${link}\t${shortLink}\t${f}\t${outfile}\n`);      
          }
        }
      } else {
        const outfile = nanohash(link) + '.html';
        if (!htmlDir.exists(outfile)) {
          htmlDir.write(outfile, html);
          htmlDir.append('log.txt', `${link}\t${link}\t${f}\t${outfile}\n`);
        }
      }
    } else if (html.startsWith('404: ')) {
      const fofLink = html.split(' ').pop();
      if (fofLink) {
        const outfile = nanohash(fofLink) + '.html';
        if (!htmlDir.exists(outfile)) {
          htmlDir.write(outfile, html);
          htmlDir.append('log.txt', `${fofLink}\t${fofLink}\t${f}\t${outfile}\n`);
        }
      } else {
        htmlDir.append('log.txt', `\t$\t${f}\t\n`);
      }
    }
  }
}
