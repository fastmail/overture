// Domain-like:
// (?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:[:]\d{2,5})?
const domainPattern = '(?:[a-z0-9](?:[a-z0-9\\-]{0,61}[a-z0-9])?\\.)+[a-z]{2,}';
const domainAndPortPattern = domainPattern + '(?:[:]\\d{2,5})?';

/**
    Property: RegExp.email
    Type: RegExp

    A regular expression for detecting an email address.
*/
const emailPattern = '[\\w\\-.%+]+@' + domainPattern + '\\b';
const emailAndQueryParamsPattern =
    emailPattern +
    // Allow query parameters in the mailto: style
    '(?:' +
    '[?][^&?\\s]+=[^\\s?&`!()\\[\\]{};:\'".,<>«»“”‘’]+' +
    '(?:&[^&?\\s]+=[^\\s?&`!()\\[\\]{};:\'".,<>«»“”‘’]+)*' +
    ')?';
const email = new RegExp('(' + emailPattern + ')', 'i');

/**
    Property: RegExp.url
    Type: RegExp

    A regular expression for detecting a url.
*/

// Path-chars
// [a-z0-9\-._~:/?#@!$&'*+,;=%\[\]()]

// Path-chars-no-brackets
// [a-z0-9\-._~:/?#@!$&'*+,;=%]

// Path-chars-possible-ending
// [a-z0-9\-_~/$*=]

// Parentheses match
// \([a-z0-9\-._~:/?#@!$&'*+,;=%\[\]]+?\)

// Part 1a: URLs with Protocol
// https?:\/\/{Domain-like}
// This matches URLs starting with http:// or https://. The domain portion
// follows RFC specifications where each subdomain segment can be up to 63
// characters long (the {0,61} allows for 61 characters in the middle, plus one
// at the start and potentially one at the end). Each segment must start and
// end with an alphanumeric character, with hyphens allowed in between. The
// domain must end with a top-level domain of at least 2 letters.
//
// Part 1b: URLs without Protocol
// (?<![@/]){Domain-like}(?!@)
// This matches domain-like patterns without explicit protocols. The negative
// lookbehind (?<![@/]) and lookahead (?!@) prevent matching email addresses or
// file paths by ensuring the domain isn't preceded by @ or /, or followed by
// @. This helps distinguish between example.com (a URL) and user@example.com
// (an email), or /foo/bar.txt
//
// Part 2: Path and Query String (Optional)
// (?:[/?#](?:[a-z0-9\-._~:/?#@!$&'*+,;=%]*[a-z0-9\-_~/$*=]|\([a-z0-9\-._~:/?#@!$&'*+,;=%\[\]]+?\))+)?
// This optional section matches the path, query parameters, and fragments that
// can follow a domain. It starts with /, ?, or # and then allows various
// URL-safe characters.
// The alternation with \([a-z0-9\-._~:/?#@!$&'*+,;=%\[\]]+?\) handles URLs
// that contain parentheses, which is common when URLs appear in markdown or
// other formats like (see https://example.com/page). The regex can match URLs
// even when they're wrapped in parentheses without incorrectly including the
// closing parenthesis as part of the URL.
// The path section also ensures URLs don't end with certain punctuation marks
// that are likely to be sentence punctuation rather than part of the URL
// itself - it requires the URL to end with an alphanumeric character or one of
// these specific characters: -_~/$*=

let urlPattern =
    '(?:https?://' +
    domainAndPortPattern +
    '|' +
    // TEMP: Disable this until we fix the build system stripping the feature
    // detection below.
    // '(?<![@/])' +
    domainAndPortPattern +
    '(?!@))' +
    "(?:[/?#](?:[a-z0-9\\-._~:/?#@!$&'*+,;=%]*[a-z0-9\\-_~/$*=]|\\([a-z0-9\\-._~:/?#@!$&'*+,;=%\\[\\]]+?\\))+)?";
try {
    new RegExp(urlPattern);
} catch (error) {
    // We still support a few old browsers that don't support negative
    // lookbehind.
    urlPattern = urlPattern.replace('(?<![@/])', '');
}

const url = new RegExp('\\b' + urlPattern, 'i');

export { email, url, emailPattern, emailAndQueryParamsPattern, urlPattern };
