import { $ } from 'execa';
import JSZip from 'jszip';
import Rar, { ArcFiles } from 'node-unrar-js';
import fs from 'node:fs/promises';
import { parse as parsePath } from 'path';

const defaults = {
  quality: 80,
  density: 300,
};

/**
 * Generate a JPEG file of the first page of a PDF, EPUB, CBR, or CBZ file.
 *
 * This is a useful alternative to tracking down high-res art for weird obscure books
 * that I happen to have digital versions of: just yoink the images straight, and
 * call it a day.
 */
export async function getCoverArt(input: string, output: string) {
  const extension = parsePath(input).ext.toLocaleLowerCase();

  switch (extension) {
    case '.pdf':
      return await $`magick -density ${defaults.density} ${input}[0] -quality ${defaults.quality} ${output}`;
      break;
    case '.cbr':
      return await fs
        .readFile(input)
        .then(data => Rar.createExtractorFromData({ data }))
        .then(rar => {
          const list = rar.getFileList();
          const fileHeaders = [...list.fileHeaders];
          const extracted = rar.extract({
            files: [fileHeaders[0].name],
          }) as ArcFiles<Uint8Array>;
          const files = [...extracted.files];
          const data = files[0];
          return data.extraction;
        })
        .then(u8a =>
          u8a ? fs.writeFile(output, Buffer.from(u8a)) : undefined,
        );
      break;
    case '.cbz':
      return await fs
        .readFile(input)
        .then(buffer => JSZip.loadAsync(buffer))
        .then(zip => Object.values(zip.files)[0].async('nodebuffer'))
        .then(cover => fs.writeFile(output, cover));
      break;
    case '.mobi':
      break;
    case '.epub':
      break;
    default:
      break;
  }

  return;
}
