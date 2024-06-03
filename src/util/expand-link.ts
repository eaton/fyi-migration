import wretch from "wretch";

export type ExpandLinkResults = {
  url: string,
  redirected: boolean,
  status: number,
  statusText?: number,
  resolved?: string,
  error?: string
}

export async function expandLink(input: string | URL) {
  const url = new URL(input);
  return wretch(url.toString())
    .head()
    .fetchError(cb => ({
      url: url.toString(),
      redirected: cb.response.redirected,
      status: cb.status,
      statusText: cb.name,
      resolved: cb.response.url,
      error: cb.text
    }))
    .internalError(cb => ({
      url: url.toString(),
      redirected: cb.response.redirected,
      status: cb.status,
      statusText: cb.name,
      resolved: cb.response.url,
      error: cb.text
    }))
    .res(response => ({
      url: url.toString(),
      redirected: response.redirected,
      status: response.status,
      statusText: response.redirected,
      resolved: response.url,
    }))
}