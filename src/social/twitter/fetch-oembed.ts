import { extract, ExtractTemplateObject } from '@eatonfyi/html';
import { canParse } from '@eatonfyi/urls';
import wretch from 'wretch';
import QueryStringAddon from 'wretch/addons/queryString';
import { z } from 'zod';

export async function getTwitterOembed(input: string) {
  const url = canParse(input) ? input : `https://x.com/twitter/status/${input}`;

  const output = await wretch('https://publish.twitter.com/oembed')
    .addon(QueryStringAddon)
    .query({ url, omit_script: true, dnt: true, hide_thread: false })
    .get()
    .unauthorized(cb => ({
      url,
      author_name: cb.name,
      error: cb.text ?? true,
    }))
    .json(json => oembedSchema.parse(json));

  if (output.html) {
    const parsed = await extractFromEmbed(output.html);
    return { ...output, ...parsed };
  }
  return { ...output, date: undefined, text: undefined };
}

const oembedSchema = z.object({
  url: z.string(),
  author_name: z.string().optional(),
  html: z.string().optional(),
  error: z.string().optional(),
});

export async function extractFromEmbed(input: string) {
  const dataTemplate: ExtractTemplateObject = {
    text: 'blockquote > p',
    date: 'blockquote > a | text',
  };
  const dataSchema = z.object({ text: z.string(), date: z.string() });
  return await extract(input, dataTemplate, dataSchema);
}

/*
Example embed markup

<blockquote class="twitter-tweet">
  <p lang="en" dir="ltr">
    If you have a large seat—which is the polite tailoring term for &quot;ass&quot;—you can use darts to make the pants follow your curves. I will demonstrate. 🧵 <a href="https://t.co/G7G7Fm55z8">pic.twitter.com/G7G7Fm55z8</a>
  </p>&mdash; derek guy (@dieworkwear)
  <a href="https://twitter.com/dieworkwear/status/1797170834429313181?ref_src=twsrc%5Etfw">June 2, 2024</a>
</blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
*/

/*
Example JSON return

{
  "url": "https:\/\/twitter.com\/dieworkwear\/status\/1797170834429313181",
  "author_name": "derek guy",
  "author_url": "https:\/\/twitter.com\/dieworkwear",
  "html": "\u003Cblockquote class=\"twitter-tweet\"\u003E\u003Cp lang=\"en\" dir=\"ltr\"\u003EIf you have a large seat—which is the polite tailoring term for &quot;ass&quot;—you can use darts to make the pants follow your curves. I will demonstrate. \uD83E\uDDF5 \u003Ca href=\"https:\/\/t.co\/G7G7Fm55z8\"\u003Epic.twitter.com\/G7G7Fm55z8\u003C\/a\u003E\u003C\/p\u003E&mdash; derek guy (@dieworkwear) \u003Ca href=\"https:\/\/twitter.com\/dieworkwear\/status\/1797170834429313181?ref_src=twsrc%5Etfw\"\u003EJune 2, 2024\u003C\/a\u003E\u003C\/blockquote\u003E\n\u003Cscript async src=\"https:\/\/platform.twitter.com\/widgets.js\" charset=\"utf-8\"\u003E\u003C\/script\u003E\n\n",
  "width": 550,
  "height": null,
  "type": "rich",
  "cache_age": "3153600000",
  "provider_name": "Twitter",
  "provider_url": "https:\/\/twitter.com",
  "version": "1.0"
}
*/
