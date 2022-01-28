#!/usr/bin/env node
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
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

const updateLang = async function (dbPath, langPath) {
    const db = JSON.parse(readFileSync(dbPath, 'utf8'));
    const { default: oldLang } = await import(join(process.cwd(), langPath));
    const lang = {};

    Object.entries(db).forEach(([key, value]) => {
        const oldValue = oldLang[key];
        lang[key] = {
            string: value.string,
            description: value.description,
            translation: oldValue ? oldValue.translation : '',
        };
        if (!oldValue || oldValue.flags || oldValue.string !== value.string) {
            lang[key].flags = ['fuzzy'];
        }
    });
    writeLang(lang, langPath);
};

// ---

const args = process.argv.slice(2);
updateLang(args[0], args[1]);
