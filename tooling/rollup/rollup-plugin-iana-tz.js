import { createFilter } from '@rollup/pluginutils';
import compile from '../tz/compile-tz.js';

export default function ianaTZ(options = {}) {
    const filter = createFilter(options.include, options.exclude);
    return {
        name: 'iana-tz',
        enforce: 'pre',
        transform(code, id) {
            if (!filter(id)) {
                return;
            }
            // eslint-disable-next-line consistent-return
            return compile(id, code);
        },
    };
}
