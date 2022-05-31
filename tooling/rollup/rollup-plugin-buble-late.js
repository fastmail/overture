// rollup-plugin-buble@0.19.6, but using renderChunk instead of transform,
// so that it only operates on the tree-shaken stuff and doesn’t mess with
// Rollup’s chances. Thereby also, Rollup has already resolved ternaries like
// DESKTOP ? x : y so that spread can be inlined.

import { transform } from 'buble';

export default function bubleLate(options) {
    if (!options) {
        options = {};
    }

    if (!options.transforms) {
        options.transforms = {};
    }
    options.transforms.forOf = false;
    options.transforms.modules = false;
    options.objectAssign = 'Object.assign';

    return {
        name: 'buble-late',
        renderChunk(code /* , _chunk, _options */) {
            try {
                return transform(code, options);
            } catch (e) {
                e.plugin = 'buble-late';
                e.frame = e.snippet;
                throw e;
            }
        },
    };
}
