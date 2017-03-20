// -------------------------------------------------------------------------- \\
// File: RegExp.js                                                            \\
// Module: Core                                                               \\
// Requires: Core.js                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/**
    Property: RegExp.email
    Type: RegExp

    A regular expression for detecting an email address.
*/
RegExp.email = /\b([\w.%+-]+@(?:[\w-]+\.)+[A-Z]{2,})\b/i;

/**
    Property: RegExp.url
    Type: RegExp

    A regular expression for detecting a url. Regexp by John Gruber, see
    <http://daringfireball.net/2010/07/improved_regex_for_matching_urls>
*/

// /\b
// (?:
//     https?:\/\/|                # URL protocol and colon
//     www\d{0,3}[.]|              # or www.
//     [a-z0-9.-]+[.][a-z]{2,}\/   # or url like thing followed by a slash
// )
// (?:
//     [^\s()<>]+|                 # Run of non-space, non-()<>{}[]
//     \([^\s()<>]+\)              # or non-space, non-()<>{}[] run inside ()
// )+
// (?:                             # End with:
//     \((?:                       # Balanced parens, one level deep
//         [^\s()<>]+|
//         (?:
//             \([^\s()<>]+\)
//         )
//     )*\)|
//     [^\s`!()\[\]{};:'".,<>?«»“”‘’] # or not a space or one of these punct
// )

RegExp.url = /\b(?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,}\/)(?:[^\s()<>]+|\([^\s()<>]+\))+(?:\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’])/i;

// TODO(cmorgan/modulify): do something about these exports: RegExp.email,
// RegExp.url
