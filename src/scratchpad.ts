import { nanohash } from "@eatonfyi/ids";
import { NormalizedUrl } from "@eatonfyi/urls";


const x = ['https://amazon.com/dp/B011T6VBT2', 'https://amazon.com/dp/B00LLOMHZ0', 'https://amazon.com/dp/0137155220']
for (const u of x) {
  console.log(`${u} : ` + nanohash(new NormalizedUrl(u).href) + '.html');
}