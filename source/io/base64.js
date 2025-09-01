/*global atob, btoa */

const b64tob64url = (string) =>
    string.replace(/[=]/g, '').replace(/[+]/g, '-').replace(/[/]/g, '_');

const b64urltob64 = (string) => string.replace(/[-]/g, '+').replace(/_/g, '/');

const b64UrlEncode = (string) => b64tob64url(btoa(string));

const b64UrlDecode = (string) => atob(b64urltob64(string));

// ---

const encodeLookup =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const decodeLookup = /* @__PURE__ */ (() => {
    const array = new Uint8Array(128);
    for (let i = 0; i < 64; i += 1) {
        array[encodeLookup.charCodeAt(i)] = i;
    }
    return array;
})();

const bytesToBase64Url = (bytes, i = 0, l = 0) => {
    if (bytes instanceof ArrayBuffer) {
        bytes = new Uint8Array(bytes);
    }
    let result = '';
    if (!l) {
        l = bytes.length;
    }
    i += 2;
    for (; i < l; i += 3) {
        result += encodeLookup[bytes[i - 2] >> 2];
        result += encodeLookup[((bytes[i - 2] & 3) << 4) | (bytes[i - 1] >> 4)];
        result += encodeLookup[((bytes[i - 1] & 15) << 2) | (bytes[i] >> 6)];
        result += encodeLookup[bytes[i] & 63];
    }
    i -= 2;
    if (i < l) {
        result += encodeLookup[bytes[i] >> 2];
        result += encodeLookup[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
        i += 1;
        if (i < l) {
            result += encodeLookup[(bytes[i] & 15) << 2];
        }
    }

    return result;
};

/// Presumes the original encoded data was bytes, so drops any bits less than a
/// full byte from the output.
const base64UrlToBytes = (base64Url, bytes = null, p = 0, i = 0) => {
    const l = base64Url.length - i;
    if (!bytes) {
        bytes = new Uint8Array(Math.floor((l * 3) / 4));
    }
    const bytesLength = bytes.length;
    for (; i < l; i += 4) {
        const encoded1 = decodeLookup[base64Url.charCodeAt(i)] || 0;
        const encoded2 = decodeLookup[base64Url.charCodeAt(i + 1)] || 0;
        const encoded3 = decodeLookup[base64Url.charCodeAt(i + 2)] || 0;
        const encoded4 = decodeLookup[base64Url.charCodeAt(i + 3)] || 0;

        if (p === bytesLength) {
            break;
        }
        bytes[p] = (encoded1 << 2) | (encoded2 >> 4);
        p += 1;

        if (p === bytesLength) {
            break;
        }
        bytes[p] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        p += 1;

        if (p === bytesLength) {
            break;
        }
        bytes[p] = ((encoded3 & 3) << 6) | encoded4;
        p += 1;
    }

    return bytes;
};

// ---

export {
    b64tob64url,
    b64urltob64,
    b64UrlEncode,
    b64UrlDecode,
    bytesToBase64Url,
    base64UrlToBytes,
};
