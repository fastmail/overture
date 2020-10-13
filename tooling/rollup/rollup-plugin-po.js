import { createFilter } from '@rollup/pluginutils';
import { compile, compileTranslation } from '../i18n/compile-po.js';

export default function po(options = {}) {
    const filter = createFilter(options.include, options.exclude);
    return {
        transform(code, id) {
            if (!filter(id) || !id.endsWith('.po')) {
                return;
            }
            id = id.slice(id.lastIndexOf('/') + 1, id.lastIndexOf('.'));
            return compile(id, code, null, false);
        },
        renderChunk(code, chunk) {
            const facadeModuleId = chunk.facadeModuleId || '';
            if (
                facadeModuleId.endsWith('.po') ||
                facadeModuleId.includes('/locale/')
            ) {
                code = code.replace(
                    /['"]?translations['"]?:\s+({[\s\S]*?\n\s*})/,
                    (_, strings) => {
                        // eslint-disable-next-line no-eval
                        const evalGlobal = eval;
                        const data = evalGlobal('(' + strings + ')');
                        const translations = options.idsInUse.map((id) =>
                            compileTranslation(data[id]),
                        );
                        return (
                            'translations: [\n' +
                            translations.join(',\n') +
                            '\n]'
                        );
                    },
                );
                return {
                    code,
                    map: { mappings: '' },
                };
            }
            return null;
        },
    };
}
