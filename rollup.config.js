import replace from '@rollup/plugin-replace';
import swcTransformLate from './tooling/rollup/rollup-plugin-swc-transform-late';

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
        },
    ],
    plugins: [
        replace({
            'import.meta.hot': false,
            'preventAssignment': true,
        }),
        swcTransformLate({
            env: { target: 'es5' },
        }),
    ],
};
