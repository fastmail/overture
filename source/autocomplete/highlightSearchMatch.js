import { create as el } from '../dom/Element.js';

// ---

const highlightSearchMatch = (text, highlightRegExp) => {
    if (!highlightRegExp) {
        return [text];
    }
    return text.split(highlightRegExp).map((value, index) => {
        if (index % 3 === 2) {
            return el('mark', [value]);
        }
        return value;
    });
};

// ---

export { highlightSearchMatch };
