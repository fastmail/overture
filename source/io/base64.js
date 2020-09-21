/*global atob, btoa */

const b64tob64url = (string) =>
    string.replace(/[=]/g, '').replace(/[+]/g, '-').replace(/[/]/g, '_');

const b64urltob64 = (string) => string.replace(/[-]/g, '+').replace(/_/g, '/');

const b64UrlEncode = (string) => b64tob64url(btoa(string));

const b64UrlDecode = (string) => atob(b64urltob64(string));

// ---

export { b64tob64url, b64urltob64, b64UrlEncode, b64UrlDecode };
