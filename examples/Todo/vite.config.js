/*eslint-env node*/
import { resolve } from 'path';

import po from '../../tooling/rollup/rollup-plugin-po.js';

export default {
    alias: {
        overture: resolve('../../source'),
        strings: resolve('../../../../localisation/strings'),
    },
    plugins: [po()],
};
