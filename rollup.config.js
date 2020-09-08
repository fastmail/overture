import buble from '@rollup/plugin-buble';
import { terser } from 'rollup-plugin-terser';

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
            plugins: [terser()],
        },
    ],
    plugins: [
        buble(),
    ],
};
