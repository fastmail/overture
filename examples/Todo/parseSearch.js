const {
    Class,
    Parse,
    Parse: { define, optional, repeat, sequence, firstMatch },
} = O;

// --- Search Grammar ---

var bool = define( 'bool', (/^(?:is:(?:not)?done)\b/) ),
    op = define( 'op', (/^(?:AND|OR|NOT)/) ),
    word = define( 'word', (/^(?:[^\s\(\)\\]|\\.)+/) ),
    phrase = firstMatch([
        sequence([
            define( 'begin:phrase', (/^"/) ),
            define( 'phrase', (/^(?:[^"\\]|\\.)*/) ),
            define( 'end:phrase', (/^"/) )
        ]),
        sequence([
            define( 'begin:phrase', (/^'/) ),
            define( 'phrase', (/^(?:[^'\\]|\\.)*/) ),
            define( 'end:phrase', (/^'/) )
        ])
    ]),
    groupPatterns,
    group = sequence( groupPatterns = [
        define( 'begin:group', (/^\(/) ),
        null, // Recursive; filled in below.
        define( 'end:group', (/^\)/) )
    ]),
    searchTerm = firstMatch([
        bool,
        op,
        phrase,
        group,
        word
    ]),
    whitespace = define( 'whitespace', (/^\s+/) ),
    parseSearch = groupPatterns[1] = sequence([
        optional( whitespace ),
        searchTerm,
        repeat( sequence([ whitespace, searchTerm ]), 0 ),
        optional( whitespace )
    ]);

// --- Parse tree ---

var normaliseBinaryOp = function ( type, children, newChildren ) {
    var i, l, node;
    for ( i = 0, l = children.length; i < l; i += 1 ) {
        node = children[i].normalise();
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

var SearchTreeNode = Class({

    init: function ( type, value, children ) {
        this.type = type;
        this.value = value;
        this.children = children || null;
    },

    normalise: function () {
        var node = this,
            children = node.children,
            type = node.type,
            isBinaryOperator = false,
            child;
        if ( children ) {
            isBinaryOperator = ( type === 'AND' || type === 'OR' );
            if ( isBinaryOperator ) {
                children = node.children =
                    normaliseBinaryOp( type, children, [] );
            }
            if ( !children.length ) {
                node = null;
            }
            else if ( !isBinaryOperator ) {
                child = children[0] = children[0].normalise();
                if ( type === 'NOT' ) {
                    if ( child.type === 'NOT' ) {
                        node = child.children[0];
                    }
                    else if ( typeof child.value === 'boolean' ) {
                        node = child;
                        node.value = !node.value;
                    }
                }
            }
            else if ( children.length === 1 ) {
                node = children[0].normalise();
            }
        }
        return node;
    },

    toFunctionString: function () {
        var type = this.type,
            value = this.value,
            children = this.children;
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
});

SearchTreeNode.fromTokens = function ( tokens ) {
    var parents = [],
        parent = new SearchTreeNode( 'AND', null, [] ),
        type, value, nextTerms,
        i, l, token, string, children;
    for ( i = 0, l = tokens.length; i < l; i += 1 ) {
        token = tokens[i];
        string = token[1];
        children = nextTerms || parent.children;
        nextTerms = null;
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
};

export default function ( string ) {
    var parse = new Parse( string.trim() );
    parseSearch( parse );
    return SearchTreeNode.fromTokens( parse.tokens ).normalise();
};
