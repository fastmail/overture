import buble from 'rollup-plugin-buble';

export default {
    format: 'iife',
    moduleName: 'O',
    plugins: [buble()],
};
