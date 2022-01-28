#!/usr/bin/env node
import { writeFileSync, readFileSync } from 'fs';
import prettier from 'prettier';

// ---

const writeLang = function (obj, filePath) {
    return prettier.resolveConfig(filePath).then((options) => {
        const json = JSON.stringify(obj, null, 4);
        const lang =
            '/* eslint-disable import/no-default-export */\nexport default' +
            json;
        const formatted = prettier.format(lang, options);
        writeFileSync(filePath, formatted);
    });
};

const dbToLang = function (dbPath, outputPath) {
    const db = JSON.parse(readFileSync(dbPath, 'utf8'));
    const lang = {};
    Object.entries(db).forEach(([key, value]) => {
        lang[key] = {
            string: value.string,
            description: value.description,
            translation: '',
        };
    });
    writeLang(lang, outputPath);
};

// ---

const args = process.argv.slice(2);
dbToLang(args[0], args[1]);
