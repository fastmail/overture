// Replace any ASCII control characters and most Bidi_Control with underscore
// to prevent tricking users into opening executable files or otherwise causing
// breakage.
//
// RLM, LRM and ALM are left alone, because they don’t break things, and are
// useful (they only affect weak characters that can go in either direction,
// most notably numbers and most punctuation; strong characters remain
// unaffected). See https://bugzilla.mozilla.org/show_bug.cgi?id=511521 for
// further discussion.
const defangFilename = (filename) =>
    filename.replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '_');

// ---

export { defangFilename };
