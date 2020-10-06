import { createFilter } from '@rollup/pluginutils';
import parseDb from '../i18n/parse-db.js';
import { readFileSync } from 'fs';

const isId = /^[A-Z0-9_]+$/;

const enumerateStrings = function (code, idsInUse, db) {
    const locRegex = /\bloc\(\s*['"`]([A-Z0-9_]+)['"`]/g;
    return code.replace(locRegex, (_, id) => {
        if (!isId.test(id)) {
            const entry = db.find(({ string }) => id === string);
            if (!entry) {
                throw new Error('String not in en.db: ' + id);
            }
            id = entry.id;
        }
        let index = idsInUse.indexOf(id);
        if (index === -1) {
            index = idsInUse.length;
            idsInUse.push(id);
        }
        return 'loc(' + index;
    });
};

export default function localise(options) {
    const idsInUse = options.idsInUse;
    const data = readFileSync(options.enDbPath, 'utf-8');
    const db = parseDb(data);
    const filter = createFilter(options.include, options.exclude);
    return {
        transform(code, id) {
            if (!filter(id)) {
                return;
            }
            return {
                code: enumerateStrings(code, idsInUse, db),
                map: { mappings: '' },
            };
        },
    };
}
