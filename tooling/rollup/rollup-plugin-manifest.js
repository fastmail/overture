// NOTE: this value must be defined outside of the plugin because it needs
// to persist from build to build (e.g. the module and nomodule builds).
// If, in the future, the build process were to extends beyond just this rollup
// config, then the manifest would have to be initialized from a file, but
// since everything  is currently being built here, it's OK to just initialize
// it as an empty object object when the build starts.
const manifest = {};

/**
 * A Rollup plugin to generate a manifest of chunk names to their filenames
 * (including their content hash). This manifest is then used by the template
 * to point to the currect URL.
 * @return {Object}
 */
export default function () {
    return {
        name: 'manifest',
        generateBundle(options, bundle) {
            for (const [file, chunk] of Object.entries(bundle)) {
                if (chunk.isAsset) {
                    // Skip assets for now
                    continue;
                }
                manifest[chunk.name] = { file, dependencies: chunk.imports };
            }

            this.emitFile({
                type: 'asset',
                fileName: options.compact
                    ? 'manifest.min.json'
                    : 'manifest.json',
                source: JSON.stringify(manifest, null, 2),
            });
        },
    };
}
