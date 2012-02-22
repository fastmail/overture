// -------------------------------------------------------------------------- \\
// File: RegExp.js                                                            \\
// Module: Core                                                               \\
// Requires: Core.js                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

/**
    Property: RegExp.email
    Type: RegExp
    
    A regular expression for detecting an email address.
*/
RegExp.email = /\b([\w\-.%+]+@(?:[\w\-]+\.)+[A-Z]{2,4})\b/i;

/**
    Property: RegExp.url
    Type: RegExp
    
    A regular expression for detecting a url. Regexp by John Gruber, see
    <http://daringfireball.net/2010/07/improved_regex_for_matching_urls>
*/
RegExp.url = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\([^\s()<>]+\))+(?:\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/i;