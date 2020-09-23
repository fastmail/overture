import { createFilter, FilterPattern } from '@rollup/pluginutils';
import fs from 'fs';
import { basename } from 'path';

const { readFile } = fs.promises;

interface Options {
    include?: FilterPattern;
    exclude?: FilterPattern;
}

async function transformSVG(path) {
    const name = basename(path, '.svg');
    const src = (await readFile(path, { encoding: 'utf-8' })).trim();
    return `import { setAttributes } from '/overture/dom';

const src = \`${src}\`;

let cachedNode = null;
const ${name} = (props) => {
    if (!cachedNode) {
        cachedNode = new DOMParser().parseFromString(src, 'image/svg+xml').firstChild;
        cachedNode.setAttribute('role', 'presentation');
        // IE11 does not support classList on SVG
        // SVG does not have a className property
        cachedNode.setAttribute(
            'class',
            (cachedNode.getAttribute('class') || '') +
                ' v-Icon i-${name.toLowerCase()}'
        );
    }
    const svg = cachedNode.cloneNode(true);
    setAttributes(svg, props);
    return svg;
}

export { ${name} };
`;
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
