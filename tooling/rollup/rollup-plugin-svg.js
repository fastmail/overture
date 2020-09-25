import { createFilter } from '@rollup/pluginutils';
import { basename } from 'path';

export default function svg(options = {}) {
    const filter = createFilter(options.include, options.exclude);
    return {
        transform(code, id) {
            if (!filter(id) || !id.endsWith('.svg')) {
                return null;
            }
            const name = basename(id, '.svg');
            return `import { setAttributes } from '/overture/dom';

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
    return svg;
}

export { drawIcon${name} };
`;
        },
    };
}
