// Invokes swc in the renderChunk phase so that swc doesn't try to inline
// code that will become unreachable after the first pass (because of, say,
// build-time constants which are replaced)

import { minifySync } from '@swc/core';

// eslint-disable-next-line import/no-default-export
export default function swcMinifyLate(options) {
    // if it is exactly the boolean true, make it an object instead
    if (typeof options === 'undefined' || options === true) {
        options = {};
    }

    // Default sourcemap generation to true, but respect any value that has
    // already been set.
    if (options && options.sourceMap === undefined) {
        options.sourceMap = true;
    }

    return {
        name: 'swc-minify-late',
        renderChunk(code /* , _chunk, _options */) {
            try {
                return minifySync(code, options);
            } catch (e) {
                e.plugin = 'swc-minify-late';
                e.frame = e.snippet;
                throw e;
            }
        },
    };
}
