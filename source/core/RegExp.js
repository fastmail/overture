/**
    Property: RegExp.email
    Type: RegExp

    A regular expression for detecting an email address.
*/
const email =
    /([\w!$&*\-=^`|~#%'+/?{}]+(?:\.[\w!$&*\-=^`|~#%'+/?{}]+)*@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})\b/;

/**
    Property: RegExp.url
    Type: RegExp

    A regular expression for detecting a url.
*/

// Domain-like:
// (?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:[:]\d{2,4})?

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
// (?!<@){Domain-like}(?!@)
// This matches domain-like patterns without explicit protocols. The negative
// lookaheads (?!<@) and (?!@) prevent matching email addresses by ensuring the
// domain isn't preceded by <@ or followed by @. This helps distinguish between
// example.com (a URL) and user@example.com (an email).
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

const url =
    /\b(?:https?:\/\/(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:[:]\d{2,4})?|(?!<@)(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:[:]\d{2,4})?(?!@))(?:[/?#](?:[a-z0-9\-._~:/?#@!$&'*+,;=%]*[a-z0-9\-_~/$*=]|\([a-z0-9\-._~:/?#@!$&'*+,;=%\[\]]+?\))+)?/i;

export { email, url };
