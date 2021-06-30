import * as crypto from 'crypto';

/**
 * A Rollup plugin to generate a manifest of chunk names to their filenames
 * (including their content hash). This manifest is then used by the template
 * to point to the currect URL.
 * @return {Object}
 */
export default function (config) {
    if (!config) {
        config = {};
    }
    const manifest = {
        files: [],
        entries: {},
        hashes: {},
    };
    const trimPrefix = config.trimPrefix || /^.*[/]/;
    return {
        name: 'manifest',
        generateBundle(options, bundle) {
            for (const [fileName, chunk] of Object.entries(bundle)) {
                if (chunk.type === 'asset') {
                    // Skip assets for now
                    continue;
                }
                if (chunk.isEntry || chunk.isDynamicEntry) {
                    const facadeModuleId = chunk.facadeModuleId;
                    const name = facadeModuleId
                        ? facadeModuleId.replace(trimPrefix, '/')
                        : chunk.name;
                    if (manifest.entries[name]) {
                        console.log(`Duplicate chunk name: ${name}`);
                    }
                    manifest.entries[name] = {
                        file: fileName,
                        dependencies: chunk.imports,
                    };
                }
                manifest.hashes[fileName] = crypto
                    .createHash('sha256')
                    .update(chunk.code, 'utf-8')
                    .digest('base64')
                    .replace(/[=]/g, '')
                    .replace(/[+]/g, '-')
                    .replace(/[/]/g, '_')
                    .slice(0, 12);
                manifest.files.push(fileName);
            }

            this.emitFile({
                type: 'asset',
                fileName: config.output || 'manifest.json',
                source: JSON.stringify(manifest, null, 2),
            });
        },
    };
}
