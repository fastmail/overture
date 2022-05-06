import { createFilter } from '@rollup/pluginutils';
import { readFileSync } from 'fs';
import { basename } from 'path';

export default function svg(options = {}) {
    const filter = createFilter(options.include, options.exclude);
    return {
        name: 'svg',
        enforce: 'pre',
        load(id) {
            if (!filter(id) || !id.endsWith('.svg')) {
                return null;
            }

            let code = readFileSync(id, { encoding: 'utf-8' }).trim();

            const name = basename(id, '.svg');
            code = `import { setAttributes } from '/overture/dom';

const src = \`${code}\`;

let cachedNode = null;
const drawIcon${name} = (props) => {
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
    const title = props && props.title;
    if (title) {
        const titleTag = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'title'
        );
        titleTag.textContent = title;
        svg.appendChild(titleTag);
    }
    return svg;
}

export { drawIcon${name} };
`;
            return { code, map: { mappings: '' } };
        },
    };
}
