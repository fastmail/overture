import { createFilter } from '@rollup/pluginutils';
import { compile, compileTranslation } from '../i18n/compile-po.js';

export default function po(options) {
    const filter = createFilter(options.include, options.exclude);
    const { filterChunk = () => true } = options;
    const { outputTranslationsAsFn = false } = options;
    return {
        name: 'po',
        enforce: 'pre',
        transform(code, id) {
            if (!filter(id) || !id.endsWith('.po')) {
                return;
            }
            id = id.slice(id.lastIndexOf('/') + 1, id.lastIndexOf('.'));
            return compile(id, code, null, outputTranslationsAsFn);
        },
        renderChunk(code, chunk) {
            if (!filterChunk(chunk)) {
                return;
            }
            code = code.replace(
                /['"]?translations['"]?:\s+({[\s\S]*?\n\s*})/g,
                (match, strings) => {
                    let data;
                    try {
                        // eslint-disable-next-line no-eval
                        const evalGlobal = eval;
                        data = evalGlobal('(' + strings + ')');
                    } catch {
                        return match;
                    }
                    const translations = options.idsInUse.map((id) =>
                        compileTranslation(data[id]),
                    );
                    return (
                        'translations: [\n' + translations.join(',\n') + '\n]'
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
