// Invokes swc in the renderChunk phase so that swc doesn't try to inline
// code that will become unreachable after the first pass (because of, say,
// build-time constants which are replaced)

import { minifySync, transformSync } from '@swc/core';

export default function swcTransformLate(options) {
    if (!options) {
        options = {};
    }
    if (!options.jsc) {
        options.jsc = {};
    }

    const minifyOptions = options.jsc.minify || {};
    options.jsc.minify = undefined;

    // Always force sourceMap generation.
    options.sourceMaps = 'inline';
    minifyOptions.sourceMap = true;

    return {
        name: 'swc-transform-late',
        renderChunk(code /* , _chunk, _options */) {
            try {
                return minifySync(transformSync(code, options), minifyOptions);
            } catch (e) {
                e.plugin = 'swc-transform-late';
                e.frame = e.snippet;
                throw e;
            }
        },
    };
}
