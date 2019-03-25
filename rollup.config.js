import buble from 'rollup-plugin-buble';

export default {
    output: {
        format: 'iife',
        name: 'O',
        extend: true,
    },
    plugins: [
        buble(),
    ],
};
