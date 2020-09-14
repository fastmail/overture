import { createFilter, FilterPattern } from '@rollup/pluginutils';
import fs from 'fs';

const { readFile } = fs.promises;

interface Options {
    include?: FilterPattern;
    exclude?: FilterPattern;
}

const parsingCode = `
const svg = new DOMParser().parseFromString(src, 'image/svg+xml').firstChild;
export default svg;
`;

async function transformSVG(path) {
    const src = (await readFile(path, { encoding: 'utf-8' })).trim();
    return `const src = \`${src}\`;` + parsingCode;
}

export default function raw(options: Options = {}) {
    const filter = createFilter(options.include, options.exclude);
    return {
        test({ path }) {
            return filter(path) && path.endsWith('.svg');
        },
        async transform({ path }) {
            return await transformSVG(path);
        },
    };
}
