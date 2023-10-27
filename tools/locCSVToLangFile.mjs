// usage: node locCSVToLangFile.mjs path/to/strings.csv path/to/target.lang.js
import { locCSVToJson } from './locCSVToJSON.mjs';

/* global console */

(async () => {
    const warnings = await locCSVToJson();
    console.log(warnings.join(''));
})();
