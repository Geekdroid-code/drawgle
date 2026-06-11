export const DEFAULT_AUTH_REDIRECT = "/project/new";

export function getSafeAuthRedirect(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\r\n]/.test(value)
  ) {
    return DEFAULT_AUTH_REDIRECT;
  }

  try {
    const baseUrl = new URL("https://drawgle.local");
    const targetUrl = new URL(value, baseUrl);

    if (targetUrl.origin !== baseUrl.origin) {
      return DEFAULT_AUTH_REDIRECT;
    }

    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}
