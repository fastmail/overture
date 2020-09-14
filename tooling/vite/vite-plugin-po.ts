import { createFilter, FilterPattern } from '@rollup/pluginutils';
import compile from '../i18n/compile-po.js';

interface Options {
    include?: FilterPattern;
    exclude?: FilterPattern;
}

export default function po(options: Options = {}) {
    const filter = createFilter(options.include, options.exclude);
    return {
        test({ id }) {
            return filter(id) && id.match(/\.po(\?import)?$/);
        },
        transform({ id, code }) {
            id = id.slice(id.lastIndexOf('/') + 1, id.lastIndexOf('.'));
            return compile(id, code).code;
        },
    };
}
