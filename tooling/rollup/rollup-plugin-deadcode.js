import { minify } from 'terser';

export default function deadcode(outputOptions) {
    /* eslint-disable camelcase */
    const options = {
        compress: {
            defaults: false,
            conditionals: true,
            dead_code: true,
            evaluate: true,
            side_effects: true,
            pure_funcs: ['Class', 'bind', 'bindTwoWay'],
        },
        mangle: false,
        output: {
            beautify: true,
            comments: 'all',
        },
        sourceMap:
            outputOptions.sourcemap === true ||
            typeof outputOptions.sourcemap === 'string',
        module: outputOptions.format === 'es' || outputOptions.format === 'esm',
    };

    return {
        name: 'deadcode',
        transform(code, id) {
            if (!id.endsWith('.js')) {
                return;
            }
            const result = minify(code, options);
            if (result.error) {
                throw result.error;
            } else {
                return result;
            }
        },
    };
}
