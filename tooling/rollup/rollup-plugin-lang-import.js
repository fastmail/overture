import { createFilter } from '@rollup/pluginutils';
import prettier from 'prettier';

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
                return;
            }
            id = id.slice(id.lastIndexOf('/') + 1).replace('.lang.js', '');

            return compile(id, code, null, outputTranslationsAsFn);
        },
        renderChunk(code, chunk) {
            if (!filterChunk(chunk)) {
                return;
            }

            const id = code.match(/['"]?code['"]?:\s*['"]([a-z-]+)['"]/)[1];
            if (!id) {
                throw new Error("Could not find ID.")
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
                    const translations = options.idsInUse.map((id) => {
                        const target = data[id];
                        if (!target) {
                            throw new Error(
                                `Couldn't find a string for: ${id}`
                            );
                        }
                        return compileTranslation(
                            JSON.parse(target),
                            fallbackRules,
                        );
                    });
                    return (
                        'translations: ' +
                        prettier
                            .format('[' + translations + ']', {
                                singleQuote: false,
                                tabWidth: 4,
                                quoteProps: 'as-needed',
                                trailingComma: 'all',
                                parser: 'babel',
                            })
                            .replace('];', ']}')
                    );
                },
            );

            return {
                code,
                map: { mappings: '' },
            };
        },
    };
}
