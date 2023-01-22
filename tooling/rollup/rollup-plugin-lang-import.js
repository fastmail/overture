import { createFilter } from '@rollup/pluginutils';

import { compile, compileTranslation } from '../i18n/compile-translation.js';

export default function langImport(options) {
    const filter = createFilter(options.include, options.exclude);
    const { filterChunk = () => true } = options;
    const { outputTranslationsAsFn = false } = options;

    return {
        name: 'langImport',
        enforce: 'post',
        transform(code, id) {
            if (
                !filter(id) ||
                !(id.endsWith('.lang.js') && id.includes('/strings/'))
            ) {
                return null;
            }
            id = id.slice(id.lastIndexOf('/') + 1).replace('.lang.js', '');

            return compile(id, code, null, outputTranslationsAsFn);
        },
        renderChunk(code, chunk) {
            if (!filterChunk(chunk)) {
                return null;
            }

            const id = code.match(/['"]?code['"]?:\s*['"]([a-z-]+)['"]/)[1];
            if (!id) {
                throw new Error('Could not find ID.');
            }
            const fallbackRules = {
                needsFallbackPluralisationFunction: true,
            };
            if (
                [
                    'bg',
                    'da',
                    'de',
                    'en',
                    'en-gb',
                    'es',
                    'es-la',
                    'fi',
                    'hu',
                    'it',
                    'nb',
                    'nl',
                    'nn',
                    'pt',
                    'sv',
                    'tr',
                ].includes(id)
            ) {
                fallbackRules.needsFallbackPluralisationFunction = false;
            }

            code = code.replace(
                /['"]?translations['"]?:\s*\{(.*)\}\s*\};/gs,
                (match, strings) => {
                    let data;
                    try {
                        // eslint-disable-next-line no-eval
                        const evalGlobal = eval;
                        data = evalGlobal(
                            '(function () { return {' + strings + '}})();',
                        );
                    } catch {
                        return match;
                    }
                    const translations = [];
                    const { idsInUse, idToIndex, isModern = true } = options;
                    idsInUse.forEach((stringId) => {
                        const index = idToIndex.get(stringId);
                        const compiled = compileTranslation(
                            JSON.parse(data[stringId]),
                            fallbackRules,
                            isModern,
                        );
                        translations[index] = compiled;
                    });
                    return 'translations: [' + translations + ']};';
                },
            );

            return {
                code,
                map: { mappings: '' },
            };
        },
    };
}
