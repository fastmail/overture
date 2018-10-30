/* global O */

const {
    Parse,
    Parse: { define, optional, repeat, sequence, firstMatch },
} = O;

// --- Search Grammar ---

const bool = define( 'bool', (/^(?:is:(?:not)?done)\b/) );
const op = define( 'op', (/^(?:AND|OR|NOT)/) );
const word = define( 'word', (/^(?:[^\s()\\]|\\.)+/) );
const phrase = firstMatch([
    sequence([
        define( 'begin:phrase', (/^"/) ),
        define( 'phrase', (/^(?:[^"\\]|\\.)*/) ),
        define( 'end:phrase', (/^"/) ),
    ]),
    sequence([
        define( 'begin:phrase', (/^'/) ),
        define( 'phrase', (/^(?:[^'\\]|\\.)*/) ),
        define( 'end:phrase', (/^'/) ),
    ]),
]);
const groupPatterns = [
    define( 'begin:group', (/^\(/) ),
    null, // Recursive; filled in below.
    define( 'end:group', (/^\)/) ),
];
const group = sequence( groupPatterns );
const searchTerm = firstMatch([
    bool,
    op,
    phrase,
    group,
    word,
]);
const whitespace = define( 'whitespace', (/^\s+/) );
const parseSearch = groupPatterns[1] = sequence([
    optional( whitespace ),
    searchTerm,
    repeat( sequence([ whitespace, searchTerm ]), 0 ),
    optional( whitespace ),
]);

// --- Parse tree ---

const normaliseBinaryOp = function ( type, children, newChildren ) {
    const len = children.length;
    for ( let i = 0; i < len; i += 1 ) {
        const node = children[i].normalise();
        if ( !node ) {
            continue;
        }
        if ( node.type === type ) {
            normaliseBinaryOp( type, node.children, newChildren );
        } else {
            newChildren.push( node );
        }
    }
    return newChildren;
};

class SearchTreeNode {
    constructor ( type, value, children ) {
        this.type = type;
        this.value = value;
        this.children = children || null;
    }

    normalise () {
        let node = this;
        let children = node.children;
        if ( children ) {
            const type = node.type;
            const isBinaryOperator = ( type === 'AND' || type === 'OR' );
            if ( isBinaryOperator ) {
                children = node.children =
                    normaliseBinaryOp( type, children, [] );
            }
            if ( !children.length ) {
                node = null;
            } else if ( !isBinaryOperator ) {
                const child = children[0] = children[0].normalise();
                if ( type === 'NOT' ) {
                    if ( child.type === 'NOT' ) {
                        node = child.children[0];
                    } else if ( typeof child.value === 'boolean' ) {
                        node = child;
                        node.value = !node.value;
                    }
                }
            } else if ( children.length === 1 ) {
                node = children[0].normalise();
            }
        }
        return node;
    }

    toFunctionString () {
        const { type, value, children } = this;
        switch ( type ) {
        case 'isComplete':
            return ( value ? '' : '!' ) + 'data.isComplete';
        case 'text':
            return '/\\b' + value.escapeRegExp() + '/i.test( data.summary )';
        case 'NOT':
            return  '!' + children[0].toFunctionString();
        case 'OR':
            return '(' + children.map( function ( child ) {
                return child.toFunctionString();
            }).join( '||' ) + ')';
        case 'AND':
            return '(' + children.map( function ( child ) {
                return child.toFunctionString();
            }).join( '&&' ) + ')';
        }
        return '';
    }

    static fromTokens ( tokens ) {
        const len = tokens.length;
        const parents = [];
        let parent = new SearchTreeNode( 'AND', null, [] );
        let nextTerms;
        for ( let i = 0; i < len; i += 1 ) {
            const token = tokens[i];
            const string = token[1];
            const children = nextTerms || parent.children;
            nextTerms = null;
            let type;
            let value;
            switch ( token[0] ) {
            case 'bool':
                type = 'isComplete';
                value = string.indexOf( 'not' ) === -1;
                break;
            case 'word':
                type = 'text';
                value = string;
                break;
            case 'phrase':
                type = 'text';
                value = string.replace( /\\(.)/g, '$1' );
                break;
            case 'begin:group':
                parents.push( parent );
                children.push( parent = new SearchTreeNode( 'AND', null, [] ) );
                continue;
            case 'end:group':
                parent = parents.pop();
                continue;
            case 'op':
                if ( string === 'AND' ) {
                    continue;
                }
                nextTerms = [];
                if ( string === 'OR' && children.length ) {
                    nextTerms.push( children.pop() );
                }
                type = string;
                value = null;
                break;
            default:
                nextTerms = children;
                continue;
            }
            children.push( new SearchTreeNode( type, value, nextTerms ) );
        }
        return parent;
    }
}

export default function ( string ) {
    const parse = new Parse( string.trim() );
    parseSearch( parse );
    return SearchTreeNode.fromTokens( parse.tokens ).normalise();
}
