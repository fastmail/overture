// usage: node locCSVToLangFile.js path/to/strings.csv path/to/target.lang.js

const fs = require('fs');
const path = require('path');
const prettier = require('prettier');

/* globals require, process */

const loadCSV = (pathToCsv) =>
    fs
        .readFileSync(path.join('./', pathToCsv))
        .toString()
        .trim()
        .split('\n')
        .map((line) => line.slice(1, -1).split('","'));

const loadTarget = (pathToTarget) =>
    // eslint-disable-next-line no-eval
    eval(
        fs
            .readFileSync(path.join('./', pathToTarget))
            .toString()
            .replace('export default ', '(function () {return ') + '})();',
    );

const locCSVToJson = () => {
    const langFilePath = process.argv[3];
    const csv = loadCSV(process.argv[2]);
    const lang = loadTarget(langFilePath);

    csv.forEach((line) => {
        const id = line[0];
        const translation = line[2];
        const target = lang[id];
        if (!target) {
            throw new Error(`${id} does not exist in target dictionary.`);
        }
        target.translation = translation;
    });

    fs.writeFileSync(
        langFilePath,
        prettier.format(
            '/* eslint-disable import/no-default-export */\nexport default ' +
                JSON.stringify(lang),
            {
                singleQuote: false,
                tabWidth: 4,
                quoteProps: 'as-needed',
                trailingComma: 'all',
                parser: 'babel',
            },
        ),
    );
};

locCSVToJson();
