import { createFilter } from '@rollup/pluginutils';
import { readFileSync } from 'fs';
import MagicString from 'magic-string';

const isId = /^[A-Z0-9_]+$/;

const enumerateStrings = function (file, code, idsInUse, db) {
    const locRegex = /\bloc\(\s*(['"`])(.*?)\1/g;
    const source = new MagicString(code);
    const keys = Object.keys(db);

    for (const match of code.matchAll(locRegex)) {
        let id = match[2];
        if (!isId.test(id)) {
            const entry = keys.find(key => db[key].string === id);
            if (!entry) {
                throw new Error('String not in en.json: ' + id);
            }
            id = entry;
        }
        let index = idsInUse.indexOf(id);
        if (index === -1) {
            index = idsInUse.length;
            idsInUse.push(id);
        }

        const start = match.index;
        const end = start + match[0].length;
        source.overwrite(start, end, 'loc(' + index);
    }

    const map = source.generateMap({
        source: file,
        includeContent: true,
    });

    return { code: source.toString(), map };
};

export default function localise(options) {
    const idsInUse = options.idsInUse;
    const data = readFileSync(options.enDbPath, 'utf-8');
    const db = JSON.parse(data);
    const filter = createFilter(options.include, options.exclude);
    return {
        transform(code, id) {
            if (!filter(id)) {
                return;
            }
            return enumerateStrings(id, code, idsInUse, db);
        },
    };
}
