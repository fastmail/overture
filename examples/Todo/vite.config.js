/*eslint-env node*/
import { resolve } from 'path';

import importLang from '../../tooling/rollup/rollup-plugin-lang-import';

export default {
    alias: {
        overture: resolve('../../source'),
        strings: resolve('../../../../localisation/strings'),
    },
    plugins: [importLang()],
};
