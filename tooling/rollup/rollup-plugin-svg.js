import { createFilter } from '@rollup/pluginutils';

const parsingCode = `
const svg = new DOMParser().parseFromString(src, 'image/svg+xml').firstChild;
export default svg;
`;

export default function svg(options = {}) {
    const filter = createFilter(options.include, options.exclude);
    return {
        transform(code, id) {
            if (!filter(id) || !id.endsWith('.svg')) {
                return;
            }
            return `const src = \`${code}\`;` + parsingCode;
        },
    };
}
