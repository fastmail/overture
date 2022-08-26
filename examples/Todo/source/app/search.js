// --- Search Grammar ---

import {
    define,
    firstMatch,
    optional,
    ParseResult,
    repeat,
    sequence,
} from '/overture/parse';

const bool = define('bool', /^(?:is:(?:not)?done)\b/);
const op = define('op', /^(?:AND|OR|NOT)/);
const word = define('word', /^(?:[^\s\(\)\\]|\\.)+/);
const phrase = firstMatch([
    sequence([
        define('begin:phrase', /^"/),
        define('phrase', /^(?:[^"\\]|\\.)*/),
        define('end:phrase', /^"/),
    ]),
    sequence([
        define('begin:phrase', /^'/),
        define('phrase', /^(?:[^'\\]|\\.)*/),
        define('end:phrase', /^'/),
    ]),
]);
let groupPatterns;
const group = sequence(
    (groupPatterns = [
        define('begin:group', /^\(/),
        null, // Recursive; filled in below.
        define('end:group', /^\)/),
    ]),
);
const searchTerm = firstMatch([bool, op, phrase, group, word]);
const whitespace = define('whitespace', /^\s+/);
const query = (groupPatterns[1] = sequence([
    optional(whitespace),
    searchTerm,
    repeat(sequence([whitespace, searchTerm]), 0),
    optional(whitespace),
]));

// --- Parse tree ---

const normaliseBinaryOp = function (type, children, newChildren) {
    let i;
    let l;
    let node;
    for (i = 0, l = children.length; i < l; i += 1) {
        node = children[i].normalise();
        if (!node) {
            continue;
        }
        if (node.type === type) {
            normaliseBinaryOp(type, node.children, newChildren);
        } else {
            newChildren.push(node);
        }
    }
    return newChildren;
};

class SearchTreeNode {
    constructor(type, value, children) {
        this.type = type;
        this.value = value;
        this.children = children || null;
    }

    normalise() {
        let node = this;
        let children = node.children;
        const type = node.type;
        let isBinaryOperator = false;
        let child;
        if (children) {
            isBinaryOperator = type === 'AND' || type === 'OR';
            if (isBinaryOperator) {
                children = node.children = normaliseBinaryOp(
                    type,
                    children,
                    [],
                );
            }
            if (!children.length) {
                node = null;
            } else if (!isBinaryOperator) {
                child = children[0] = children[0].normalise();
                if (type === 'NOT') {
                    if (child.type === 'NOT') {
                        node = child.children[0];
                    } else if (typeof child.value === 'boolean') {
                        node = child;
                        node.value = !node.value;
                    }
                }
            } else if (children.length === 1) {
                node = children[0].normalise();
            }
        }
        return node;
    }

    toFunctionString() {
        const type = this.type;
        const value = this.value;
        const children = this.children;
        switch (type) {
            case 'isComplete':
                return (value ? '' : '!') + 'data.isComplete';
            case 'text':
                return (
                    '/\\b' + value.escapeRegExp() + '/i.test( data.summary )'
                );
            case 'NOT':
                return '!' + children[0].toFunctionString();
            case 'OR':
                return (
                    '(' +
                    children
                        .map((child) => {
                            return child.toFunctionString();
                        })
                        .join('||') +
                    ')'
                );
            case 'AND':
                return (
                    '(' +
                    children
                        .map((child) => {
                            return child.toFunctionString();
                        })
                        .join('&&') +
                    ')'
                );
        }
        return '';
    }
}

SearchTreeNode.fromTokens = function (tokens) {
    const parents = [];
    let parent = new SearchTreeNode('AND', null, []);
    let type;
    let value;
    let nextTerms;
    let i;
    let l;
    let token;
    let string;
    let children;
    for (i = 0, l = tokens.length; i < l; i += 1) {
        token = tokens[i];
        string = token[1];
        children = nextTerms || parent.children;
        nextTerms = null;
        switch (token[0]) {
            case 'bool':
                type = 'isComplete';
                value = string.indexOf('not') === -1;
                break;
            case 'word':
                type = 'text';
                value = string;
                break;
            case 'phrase':
                type = 'text';
                value = string.replace(/\\(.)/g, '$1');
                break;
            case 'begin:group':
                parents.push(parent);
                children.push((parent = new SearchTreeNode('AND', null, [])));
                continue;
            case 'end:group':
                parent = parents.pop();
                continue;
            case 'op':
                if (string === 'AND') {
                    continue;
                }
                nextTerms = [];
                if (string === 'OR' && children.length) {
                    nextTerms.push(children.pop());
                }
                type = string;
                value = null;
                break;
            default:
                nextTerms = children;
                continue;
        }
        children.push(new SearchTreeNode(type, value, nextTerms));
    }
    return parent;
};

// ---

const parseSearch = function (string) {
    const parse = new ParseResult(string.trim());
    query(parse);
    return SearchTreeNode.fromTokens(parse.tokens).normalise();
};

export { parseSearch };
