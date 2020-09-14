import { createFilter, FilterPattern } from '@rollup/pluginutils';
import compile from '../tz/compile-tz.js';

interface Options {
    include?: FilterPattern;
    exclude?: FilterPattern;
}

export default function ianaTZ(options: Options = {}) {
    const filter = createFilter(options.include, options.exclude);
    return {
        test({ id }) {
            return filter(id);
        },
        transform({ id, code }) {
            return compile(id, code).code;
        },
    };
}
