import { createFilter } from '@rollup/pluginutils';
import { readFileSync } from 'fs';
import MagicString from 'magic-string';

const isId = /^[A-Z0-9_]+$/;

const enumerateStrings = function (file, code, idsInUse, idToIndex, db) {
    const locRegex = /\bloc\(\s*(['"`])(.*?)\1/g;
    const source = new MagicString(code);

    for (const match of code.matchAll(locRegex)) {
        let id = match[2];
        if (!isId.test(id)) {
            const entry = db.find(([, { string }]) => string === id);
            if (!entry) {
                throw new Error('String not in en.json: ' + id);
            }
            id = entry[0];
        }
        const index = idToIndex.get(id);
        if (index === undefined) {
            throw new Error('String not in en.json: ' + id);
        }
        idsInUse.add(id);

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

export function localise(options) {
    const idsInUse = options.idsInUse;
    const idToIndex = options.idToIndex;
    const data = readFileSync(options.enDbPath, 'utf-8');
    const db = Object.entries(JSON.parse(data));
    const filter = createFilter(options.include, options.exclude);
    return {
        transform(code, id) {
            if (!filter(id)) {
                return null;
            }
            return enumerateStrings(id, code, idsInUse, idToIndex, db);
        },
    };
}
