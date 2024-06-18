import { $ } from 'execa';
import { parse as parsePath } from 'path';
import fs from 'node:fs/promises'
import JSZip from 'jszip';
import Rar, { ArcFiles } from 'node-unrar-js';

const defaults = {
  quality: 80,
  density: 300
}

/**
 * Generate a JPEG file of the first page of a PDF, EPUB, CBR, or CBZ file.
 */
export async function renderCoverArt(input: string, output: string) {
  const extension = parsePath(input).ext.toLocaleLowerCase();

  switch (extension) {
    case '.pdf':
      return await $`magick -density ${defaults.density} ${input}[0] -quality ${defaults.quality} ${output}`;
      break;
    case '.cbr':
      return await fs.readFile(input)
        .then(data => Rar.createExtractorFromData({ data }))
        .then((rar) => {
          const list = rar.getFileList();
          const fileHeaders = [...list.fileHeaders];
          const extracted = rar.extract({ files: [fileHeaders[0].name] }) as ArcFiles<Uint8Array>;
          const files = [...extracted.files];
          const data = files[0];
          return data.extraction;
        })
        .then(u8a => u8a ? fs.writeFile(output, Buffer.from(u8a)) : undefined)
      break;
    case '.cbz':
      return await fs.readFile(input)
        .then(buffer => JSZip.loadAsync(buffer))
        .then(zip =>  Object.values(zip.files)[0].async('nodebuffer'))
        .then(cover => fs.writeFile(output, cover))
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
