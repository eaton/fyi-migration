import { HttpsProxyAgent } from 'https-proxy-agent';
import wretch from 'wretch';
import { throttlingCache } from 'wretch/middlewares'
import { getRotator } from './util/get-rotator.js';
import { extract } from '@eatonfyi/html';
import { getDefaults } from './util/get-defaults.js';

const urls = {
  hardcover: 'https://www.amazon.com/dp/0441009123',
  kindle: 'https://www.amazon.com/dp/B0819TXR83',
  clothing: 'https://www.amazon.com/dp/B00A74HY12',
  game: 'https://www.amazon.com/dp/B00NX627HW',
  bluray: 'https://www.amazon.com/dp/B09X175QH5'
}

const globalDefaults = getDefaults();
const proxies = globalDefaults.proxies.map(ip => new HttpsProxyAgent(`https://${ip}`))
const getProxy = getRotator(proxies);

const proxiedWretch = wretch().options({ agent: getProxy() });
const throttledWretch = proxiedWretch.middlewares([throttlingCache({ throttle: 10_000 })]);

for (const url of Object.values(urls)) {
  await throttledWretch
    .get(url)
    .notFound(err => console.log(`${err.status}: ${err.url}`))
    .text(html => extract(html, {
        title: '#productTitle',
        images: '#altImages > ul > li.imageThumbnail img | attr:src'
      })
    )
    .then(extracted => console.log(extracted));
}
