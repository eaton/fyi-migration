import wretch from 'wretch';
import { WretchError } from 'wretch/resolver';

export type ExpandLinkResults = {
  url: string;
  redirected: boolean;
  status: number;
  statusText?: number;
  resolved?: string;
  error?: string;
};

export async function expandLink(input: string | URL) {
  const url = new URL(input);
  return wretch(url.toString())
    .get()
    .timeout(err => ({
      url: url.toString(),
      redirected: err.response?.redirected,
      resolved: err.response?.url,
      status: err.status,
      statusText: (err.cause as Error).message
    }))
    .fetchError(cb => ({
      url: url.toString(),
      redirected: cb.response?.redirected,
      resolved: cb.response?.url,
      status: cb.status,
      statusText: (cb.cause as Error).message,
      error: cb.text,
    }))
    .internalError(cb => ({
      url: url.toString(),
      redirected: cb.response?.redirected,
      status: cb.status,
      statusText: cb.name,
      resolved: cb.response?.url,
      error: cb.text,
    }))
    .res(response => ({
      url: url.toString(),
      redirected: response.redirected,
      status: response.status,
      statusText: response.redirected,
      resolved: response.url,
    }))
    .catch((err: WretchError) => ({
      url: url.toString(),
      redirected: err.response?.redirected,
      resolved: err.response?.url,
      status: err.status,
      statusText: (err.cause as Error).message
    }))

}
