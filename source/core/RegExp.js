// Domain-like:
// (?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:[:]\d{2,5})?
const domainPattern =
    '(?:[a-z0-9](?:[a-z0-9\\-]{0,61}[a-z0-9])?\\.)+(?:xn--[a-z0-9]+(?:-[a-z0-9]+)*|[a-z]{4,}|aaa|abb|abc|ac|aco|ad|ads|ae|aeg|af|afl|ag|ai|aig|al|am|an|anz|ao|aol|app|aq|ar|art|as|at|au|aw|aws|ax|axa|az|ba|bar|bb|bbc|bbt|bcg|bcn|bd|be|bet|bf|bg|bh|bi|bid|bio|biz|bj|bl|bm|bms|bmw|bn|bnl|bo|bom|boo|bot|box|bq|br|bs|bt|buy|bv|bw|by|bz|bzh|ca|cab|cal|cam|car|cat|cba|cbn|cbs|cc|cd|ceb|ceo|cf|cfa|cfd|cg|ch|ci|ck|cl|cm|cn|co|com|cpa|cr|crs|csc|cu|cv|cw|cx|cy|cz|dad|day|dds|de|dev|dhl|diy|dj|dk|dm|dnp|do|dog|dot|dtv|dvr|dz|eat|ec|eco|edu|ee|eg|eh|er|es|esq|et|eu|eus|fan|fi|fit|fj|fk|fly|fm|fo|foo|fox|fr|frl|ftr|fun|fyi|ga|gal|gap|gay|gb|gd|gdn|ge|gea|gf|gg|gh|gi|gl|gle|gm|gmo|gmx|gn|goo|gop|got|gov|gp|gq|gr|gs|gt|gu|gw|gy|hbo|hiv|hk|hkt|hm|hn|hot|how|hr|ht|htc|hu|ibm|ice|icu|id|ie|ifm|il|im|in|inc|ing|ink|int|io|iq|ir|is|ist|it|itv|iwc|jcb|jcp|je|jio|jlc|jll|jm|jmp|jnj|jo|jot|joy|jp|ke|kfh|kg|kh|ki|kia|kim|km|kn|kp|kpn|kr|krd|kw|ky|kz|la|lat|law|lb|lc|lds|li|lk|llc|llp|lol|lpl|lr|ls|lt|ltd|lu|lv|ly|ma|man|map|mba|mc|mcd|md|me|med|men|meo|mf|mg|mh|mil|mit|mk|ml|mlb|mls|mm|mma|mn|mo|moe|moi|mom|mov|mp|mq|mr|ms|msd|mt|mtn|mtr|mu|mv|mw|mx|my|mz|na|nab|nba|nc|ne|nec|net|new|nf|nfl|ng|ngo|nhk|ni|nl|no|now|np|nr|nra|nrw|ntt|nu|nyc|nz|obi|off|om|one|ong|onl|ooo|org|ott|ovh|pa|pay|pe|pet|pf|pg|ph|phd|pid|pin|pk|pl|pm|pn|pnc|pr|pro|pru|ps|pt|pub|pw|pwc|py|qa|qvc|re|red|ren|ril|rio|rip|ro|rs|ru|run|rw|rwe|sa|sap|sas|sb|sbi|sbs|sc|sca|scb|sd|se|ses|sew|sex|sfr|sg|sh|si|sj|sk|ski|sky|sl|sm|sn|so|soy|spa|sr|srl|srt|ss|st|stc|su|sv|sx|sy|sz|tab|tax|tc|tci|td|tdk|tel|tf|tg|th|thd|tj|tjx|tk|tl|tm|tn|to|top|tp|tr|trv|tt|tui|tv|tvs|tw|tz|ua|ubs|ug|uk|um|uno|uol|ups|us|uy|uz|va|vc|ve|vet|vg|vi|vig|vin|vip|vn|vu|wed|wf|win|wme|wow|ws|wtc|wtf|xin|xxx|xyz|ye|you|yt|yun|za|zip|zm|zw)\\b';
const domainAndPortPattern = domainPattern + '(?:[:]\\d{2,5})?';
const domain = new RegExp('^' + domainPattern + '$', 'i');

/**
    Property: RegExp.email
    Type: RegExp

    A regular expression for detecting an email address.
*/
const emailPattern = '[\\w\\-.%+]+@' + domainPattern;
// The lookbehind only lets a match start at the beginning of a run of
// local-part chars, or at its first word char so a leading \b can match
// (e.g. john@example.com in -john@example.com); without it, a long run with
// no @ is rescanned from every word boundary in it, which is quadratic.
let emailAndQueryParamsPattern =
    '(?<=(?:^|[^\\w\\-.%+])[\\-.%+]*)' +
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
// (?:^|(?<=[<({[=\\s]))(?![\\w\\-.%+]*@){Domain-like}(?![@a-z0-9]))
// This matches domain-like patterns without explicit protocols. The lookbehind
// (?:^|(?<=[<({[=\\s])) and lookaheads prevent matching email addresses or
// file paths by ensuring the domain is preceded by an open bracket or space
// and is not the start of a run of local-part chars ending in an @. This helps
// distinguish between example.com (a URL) and user@example.com or
// john.smith+x@example.com (emails), or /foo/bar.txt. The trailing negative
// lookahead for a-z0-9 stops it ending inside a word, e.g. after a port.
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
    '(?:^|(?<=[<({[=\\s]))' +
    '(?![\\w\\-.%+]*@)' +
    domainAndPortPattern +
    '(?![@a-z0-9]))' +
    "(?:[/?#](?:[a-z0-9\\-._~:/?#@!$&'*+,;=%]*[a-z0-9\\-_~/$*=]|\\([a-z0-9\\-._~:/?#@!$&'*+,;=%\\[\\]]+?\\))+)?";
try {
    new RegExp(urlPattern);
} catch (error) {
    // We still support a few old browsers that don't support lookbehind.
    urlPattern = urlPattern.replace('(?:^|(?<=[<({[=\\s]))', '');
    emailAndQueryParamsPattern = emailAndQueryParamsPattern.replace(
        '(?<=(?:^|[^\\w\\-.%+])[\\-.%+]*)',
        '',
    );
}

const url = new RegExp('\\b' + urlPattern, 'i');

const controlChars = /[\u0000-\u001f\u007f]/g;

export {
    domain,
    email,
    url,
    controlChars,
    domainPattern,
    emailPattern,
    emailAndQueryParamsPattern,
    urlPattern,
};
