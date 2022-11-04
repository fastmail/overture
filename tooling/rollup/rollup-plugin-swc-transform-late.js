// Invokes swc in the renderChunk phase so that swc doesn't try to inline
// code that will become unreachable after the first pass (because of, say,
// build-time constants which are replaced)

import { transformSync } from '@swc/core';

// eslint-disable-next-line import/no-default-export
export default function swcTransformLate(options) {
    if (!options) {
        options = {};
    }

    if (typeof options.sourceMaps === 'undefined') {
        options.sourceMaps = true;
    }

    return {
        name: 'swc-transform-late',
        renderChunk(code /* , _chunk, _options */) {
            try {
                return transformSync(code, options);
            } catch (e) {
                e.plugin = 'swc-transform-late';
                e.frame = e.snippet;
                throw e;
            }
        },
    };
}
