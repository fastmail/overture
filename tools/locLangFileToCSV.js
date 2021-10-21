// usage: node locLangFileToCSV.js path/to/db.json ...paths/to/dictionaries.lang.js

const fs = require('fs');
const path = require('path');

/* globals require, process, console */

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

const locJsonToCSV = () => {
    const db = readFileToObject(process.argv[2]);
    const langFileNames = process.argv
        .slice(3)
        .filter((name) => languages[getLangCodeFromFileName(name)]);
    const langObjs = langFileNames.map((name) => readFileToObject(name));
    const langCodes = langFileNames.map(getLangCodeFromFileName);

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
        // TODO: add flag for whether or not to export all strings
        if (langObjs.every((lang) => lang[id].translation)) {
            return;
        }
        csvRows.push([
            id,
            dbObj.string,
            // TODO flag to toggle "fuzzy"
            ...langObjs.map((langObj) => langObj[id].translation),
            dbObj.description,
        ]);
    });

    return csvRows.reduce(
        (body, currentRow, index) =>
            body +
            (index ? '\n' : '') +
            currentRow.reduce(
                (row, cell, rowIndex) =>
                    row + `${rowIndex ? ',' : ''}"${cell}"`,
                '',
            ),
        '',
    );
};

console.log(locJsonToCSV());
