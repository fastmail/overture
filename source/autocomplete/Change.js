import { create as el } from '../dom/Element.js';

// ---

/**
 * Change describes some mutation to a string of characters. The characters
 * from start (inclusive) to end (exclusive) will be replaced with the provided
 * content.
 */
class Change {
    /**
     * @param {number} start
     * @param {number} end
     * @param {string} content - Content to replace the characters between
     *                           start and end
     * @param {boolean} shouldSubmit - Should the input be submitted when
     *                                 applying this change?
     */
    constructor(start, end, content, shouldSubmit = true) {
        /** @type {number} */
        this.start = start;
        /** @type {number} */
        this.end = end;
        /** @type {string} */
        this.content = content;
        /** @type {number} */
        this.delta = start - end + content.length;
        /** @type {boolean} */
        this.shouldSubmit = shouldSubmit;
    }

    /**
     * Returns a new string with the change applied.
     *
     * @param {string} string
     * @returns {string}
     */
    apply(string) {
        return (
            string.slice(0, this.start) + this.content + string.slice(this.end)
        );
    }

    /**
     * Renders the result of applying this change to the given string.
     *
     * @param {string} string
     * @returns {[string, HtmlElement, string]}
     */
    draw(string) {
        const { content, start, end } = this;
        let prefixOffset = 0;
        if (start !== end) {
            const replaced = string.slice(start, end);
            if (
                content
                    .toLocaleLowerCase()
                    .startsWith(replaced.toLocaleLowerCase())
            ) {
                prefixOffset = replaced.length;
            } else {
                return [string];
            }
        }
        return [
            string.slice(0, this.start + prefixOffset),
            el('mark', [this.content.slice(prefixOffset)]),
            string.slice(this.end),
        ];
    }

    /**
     * Map a position in the original string to a new position in the updated
     * string.
     *
     * @param {number} pos
     * @returns {number}
     */
    map(pos) {
        const { start, delta } = this;
        if (pos < start) {
            return pos;
        }
        pos += delta;
        if (pos < start) {
            return start;
        }
        return pos;
    }

    /**
     * Update the start/end properties of a selection by mapping them to new
     * positions.
     *
     * @param {{ start: number, end: number }} selection
     * @returns {{ start: number, end: number }}
     */
    updateSelection(selection) {
        selection.start = this.map(selection.start);
        selection.end = this.map(selection.end);
        return selection;
    }

    /**
     * @param {number} start
     * @param {number} count
     * @returns {Change}
     */
    static delete(start, count) {
        return new Change(start, start + count, '');
    }

    /**
     * @param {number} start
     * @param {string} content
     * @returns {Change}
     */
    static insert(start, content) {
        return new Change(start, start, content);
    }

    /**
     * @param {number} start
     * @param {number} end
     * @param {string} content
     * @returns {Change}
     */
    static overwrite(start, end, content) {
        return new Change(start, end, content);
    }

    /**
     * @param {{ start: number, end: number }} node
     * @param {string} content
     * @returns {Change}
     */
    static replace(node, content) {
        return new Change(node.start, node.end, content);
    }

    static noop() {
        return new Change(0, 0, '');
    }
}

// ---

export { Change };
