// usage: node locLangFileToCSV.mjs path/to/db.json ...paths/to/dictionaries.lang.js
// output: translation-{YYYYMMDD}-SHA{SHA of HEAD}.csv

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/* globals process */

const languages = {
    'bg': 'Bulgarian',
    'cs': 'Czech',
    'da': 'Danish',
    'de': 'German',
    'es': 'Spanish',
    'fi': 'Finnish',
    'fr': 'French',
    'hu': 'Hungarian',
    'id': 'Indonesian',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'nl': 'Dutch',
    'nn': 'Norwegian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'sk': 'Slovak',
    'sv': 'Swedish',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'vi': 'Vietnamese',
    'zh': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
};

const readFileToObject = (name) => {
    const fileContents = fs.readFileSync(path.join('./', name));
    if (name.endsWith('.json')) {
        return JSON.parse(fileContents);
    }
    // eslint-disable-next-line no-eval
    return eval(
        fileContents
            .toString()
            .replace('export default ', '(function () {return ') + '})();',
    );
};

const getLangCodeFromFileName = (name) =>
    name.split('/').pop().split('.').shift();

const isFuzzy = (langObj) => {
    const flags = langObj.flags;
    return flags && flags.includes('fuzzy');
};

const padDate = (date) => String(date).padStart(2, '0');

const wrapQuotes = (string) =>
    string
        ? string.replaceAll(/"([\p{L}\p{N}\p{Z}\p{S}]+?[^ "]?)"/gu, '“$1”')
        : string;

const locJsonToCSV = () => {
    const db = readFileToObject(process.argv[2]);
    const langFileNames = process.argv
        .slice(3)
        .filter((name) => languages[getLangCodeFromFileName(name)]);
    const langObjs = langFileNames.map((name) => readFileToObject(name));
    const langCodes = langFileNames.map(getLangCodeFromFileName);
    const now = new Date();
    const fileName = `translations-${now.getFullYear()}${padDate(
        now.getMonth() + 1,
    )}${padDate(now.getDate())}-SHA${execSync('git rev-parse --short HEAD')
        .toString()
        .trim()}.csv`;

    const csvRows = [
        [
            'String ID',
            'Source text',
            ...langCodes.map((code) => languages[code]),
            'Context',
        ],
    ];

    Object.keys(db).forEach((id) => {
        const dbObj = db[id];
        // Skip this row if none of these strings are fuzzy.  An empty string
        // will always be fuzzy.
        if (langObjs.every((lang) => !isFuzzy(lang[id]))) {
            return;
        }
        csvRows.push([
            id,
            // Strings with nested quotes will break in Crowdin. We
            // need to wrap the quotes in quotes to maintain structure.
            wrapQuotes(dbObj.string),
            ...langObjs.map((langObj) => {
                const thisLangObj = langObj[id];
                if (isFuzzy(thisLangObj)) {
                    return '';
                }
                return wrapQuotes(thisLangObj.translation);
            }),
            wrapQuotes(dbObj.description),
        ]);
    });

    fs.writeFileSync(
        fileName,
        csvRows.reduce(
            (body, currentRow, index) =>
                body +
                (index ? '\n' : '') +
                currentRow.reduce(
                    (row, cell, rowIndex) =>
                        row + `${rowIndex ? ',' : ''}"${cell}"`,
                    '',
                ),
            '',
        ),
    );
};

locJsonToCSV();
