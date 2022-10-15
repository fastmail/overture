import replace from '@rollup/plugin-replace';
import swcTransformLate from './tooling/rollup/rollup-plugin-swc-transform-late';
import swcMinifyLate from './tooling/rollup/rollup-plugin-swc-minify-late';

// eslint-disable-next-line import/no-default-export
export default {
    input: ['source/Overture.js'],
    output: [
        {
            file: 'dist/O.js',
            format: 'iife',
            name: 'O',
            compact: false,
            sourcemap: false,
        },
        {
            file: 'dist/O.min.js',
            format: 'iife',
            name: 'O',
            compact: true,
            sourcemap: true,
            plugins: [
                swcMinifyLate({
                    sourceMap: true,
                }),
            ],
        },
    ],
    plugins: [
        replace({
            'import.meta.hot': false,
            'preventAssignment': true,
        }),
        swcTransformLate({
            env: { targets: 'bb 10, iOS >= 9, ie >= 11, last 5 years' },

            sourceMaps: true,
        }),
    ],
};
