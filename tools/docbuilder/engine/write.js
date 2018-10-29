/*global console, require, process */

"use strict";

var fs = require( 'fs' ),
    md = require( './markdown/markdown.js' ),
    hl = require( './highlight/highlight.js').Highlight;

String.prototype.escapeHTML = function () {
    return this.split( '&' ).join( '&amp;' )
               .split( '<' ).join( '&lt;'  )
               .split( '>' ).join( '&gt;'  );
};

String.prototype.capitalise = function () {
    return this.charAt( 0 ).toUpperCase() + this.slice( 1 );
};

var el = function ( tag, props, children ) {
    if ( props instanceof Array ) {
        children = props;
        props = null;
    }

    var splitter = /(#|\.)/,
        i, j, l, prop, parts, name;

    if ( splitter.test( tag ) ) {
        parts = tag.split( splitter );
        tag = parts[0];
        if ( !props ) { props = {}; }
        for ( i = 1, j = 2, l = parts.length; j < l; i += 2, j += 2 ) {
            name = parts[j];
            if ( parts[i] === '#' ) {
                props.id = name;
            } else {
                props.className = props.className ?
                    props.className + ' ' + name : name;
            }
        }
    }

    var output = '<' + tag;
    for ( prop in props ) {
        if ( props[ prop ] ) {
            output += ' ' + ( prop === 'className' ? 'class' : prop ) +
                '="' + props[ prop ] + '"';
        }
    }
    output += '>';

    if ( children ) {
        output += children.join( '' );
    }

    output += '</' + tag + '>';

    return output;
};

var index = {};
var pathToRoot = '';

var makeId = function ( path ) {
    return path.replace( /[#.]/g, '_' );
};
var makeLink = function ( path, className ) {
    var file = index.pathToFile[ path ],
        link =  pathToRoot + file + '#' + makeId( path );
    return file ? el( 'a', { className: className, href: link }, [
        path.escapeHTML()
    ]) : path.escapeHTML();
};
var insertTables = function ( text ) {
    var output = '',
        inDL = false,
        begin = /^(\w+)\s+- (.*)$/;
    text = text.split( '\n' ).map( function ( line, i, arr ) {
        var results = begin.exec( line );
        if ( inDL ) {
            if ( results ) {
                return '</td></tr><tr><th>' + results[1] +
                    '</th><td>' + results[2];

            } else {
                if ( /^\s*$/.test( line ) ) {
                    inDL = false;
                    return '</td></tr>\n</tbody>\n</table>';
                }
                return line;
            }
        } else {
            if ( results ) {
                inDL = true;
                return '<table>\n<tbody>\n<tr><th>' + results[1] +
                    '</th><td>' + results[2];
            } else {
                return line;
            }
        }
    }).join( '\n' );
    if ( inDL ) {
        text += '</td></tr>\n</tbody>\n</table>';
    }
    return text;
};

var renderText = function ( text, parentPath ) {
    text = insertTables( text );
    return hl( md.toHTML( text ), false, true ).replace( /&lt;(\S+?)&gt;/g,
            function ( _, link ) {
        if ( link.indexOf( '//' ) === -1 ) {
            return index.pathToFile[ link ] ?
                makeLink( link ) : /\\?t(?:[rdh]|able|body)/.test( link ) ?
                    '<' + link + '>' : _;
        }
        return el( 'a', { href: link });
    }).replace( /\{([A-Za-z\_\.\-\#\*<>|\(\)]+)\}/g, function ( _, type ) {
        var file = index.pathToFile[ type ];
        return file ?
            makeLink( type, 'type' ) :
            el( 'span.type', [ type.escapeHTML() ]);
    }).replace( /\(optional\)/g, el( 'span.optional', [ 'Optional' ]));
};

var renderClass = function ( block ) {
    var access = block.access !== 'public' ?
        el( 'span.' + block.access, [ block.access.capitalise() ]) + ' ' : '';

    return [
        el( 'h4', [ access, block.type ]),
        el( 'h2', [ block.path ]),
        ( block.Extends || block.Includes ) ? el( 'dl.classProps', [
            block.Extends ? el( 'dt', [ 'Extends' ]) : '',
            block.Extends ? el( 'dd', [ makeLink( block.Extends ) ]) : '',
            block.Includes ? el( 'dt', [ 'Includes' ]) : '',
            block.Includes ? el( 'dd', [
                block.Includes
                    .split( /,\s*/ )
                    .map( makeLink )
                    .join( ', ')
            ]) : ''
        ]): '',
        renderText( block.Description, block.path )
    ];
};

var renderMethod = function ( block, namespace ) {
    var access = block.access !== 'public' ?
        el( 'span.' + block.access, [ block.access.capitalise() ]) + ' ' : '';
    var name = block.path;
    var i = name.lastIndexOf( '#' );
    if ( i < 0 ) {
        i = name.lastIndexOf( '-' );
    }
    if ( name.slice( 0, i ) === namespace ) {
        name = el( 'span.path', [ namespace ]) + name.slice( i );
    }

    var params = block.Parameters,
        plist = [],
        pname = /^\s*([A-Za-z]+)\s+\-/mg,
        result;
    if ( params ) {
        while ( result = pname.exec( params ) ) {
            plist.push( result[1] );
        }
        name += '( ' + plist.join( ', ') + ' )';
    } else {
        name += '()';
    }

    return [
        el( 'h4', [ access, block.type ]),
        el( 'h2', [ name ]),
        block.Description ? renderText( block.Description ) : '',
        block.Parameters ? el( 'h3', [ 'Parameters' ]) : '',
        block.Parameters ? renderText( block.Parameters ) : '',
        block.Returns ? el( 'h3', [ 'Returns' ]) : '',
        block.Returns ? renderText( block.Returns ) : '',
    ];
};

var renderProperty = function ( block, namespace ) {
    var access = block.access !== 'public' ?
        el( 'span.' + block.access, [ block.access.capitalise() ]) + ' ' : '';
    var name = block.path;
    var i = name.lastIndexOf( '#' );
    if ( i < 0 ) {
        i = name.lastIndexOf( '-' );
    }
    if ( name.slice( 0, i ) === namespace ) {
        name = el( 'span.path', [ namespace ]) + name.slice( i );
    }
    return [
        el( 'h4', [ access, block.type ]),
        el( 'h2', [ name ]),
        el( 'ul.attributes', [
            el( 'li.type', [ makeLink( block.Type ) ]),
            block.access !== 'public' ?
                el( 'li.access', [ block.access ]) : ''
        ]),
        block.Description ? renderText( block.Description ) : '',
    ];
};

var renderGeneric = function ( block ) {
    var access = block.access !== 'public' ?
        el( 'span.' + block.access, [ block.access.capitalise() ]) + ' ' : '';
    return [
        el( 'h4', [ access, block.type ]),
        el( 'h2', [ block.path ]),
        block.Description ? renderText( block.Description ) : '',
    ];
};

var renderSections = function ( input ) {
    var currentNamespace = null;
    var highlighted = hl( input.blocks.reduce( function ( current, block, i ) {
            if ( i ) { current += '\n//!!SPLIT!!\n'; }
            current += block.code;
            return current;
        }, '' ) )
        // Reduce tab size to 2 spaces instead of 4.
        .replace( /^( {4,})/gm, function ( _, space ) {
            var length = space.length;
            return new Array( ( length >> 1 ) + ( length % 4 ) ).join( ' ' );
        })
        .split( '\n<span class="comment">//!!SPLIT!!</span>\n');
    input.blocks.forEach( function ( block, i ) {
        block.code = highlighted[i];
    });
    return input.blocks.map( function ( block, i, arr ) {
        var docs;
        switch ( block.type ) {
            case 'Module':
                return '';
            case 'Namespace':
            case 'Class':
            case 'Mixin':
                currentNamespace = block.path;
                docs = renderClass( block );
                break;
            case 'Constructor':
            case 'Function':
            case 'Method':
                docs = renderMethod( block, currentNamespace );
                break;
            case 'Property':
                docs = renderProperty( block, currentNamespace );
                break;
            default:
                docs = renderGeneric( block );
        }
        return el( 'section', {
            id: makeId( block.path ),
            className: block.type.toLowerCase() + ' ' + block.access,
            style: 'z-index: ' + ( arr.length - i )  + ';'
        }, [
            el( 'div.docs', docs ),
            el( 'div.code', [
                el( 'pre', [
                    el( 'code', [
                        block.code
                    ])
                ])
            ])
        ]);
    }).join( '\n' );
};

var plurals = {
    Class: 'Classes',
    Constructor: 'Constructors',
    Event: 'Events',
    Function: 'Functions',
    Method: 'Methods',
    Mixin: 'Mixins',
    Namespace: 'Namespaces',
    Property: 'Properties'
};

var renderTOC = function ( input ) {
    var sections = {};
    input.blocks.forEach( function ( block ) {
        var type = block.type;
        if ( !sections[ type ] ) {
            sections[ type ] = [];
        }
        sections[ type ].push( block.path );
    });

    for ( var type in sections ) {
        if ( type === 'Module' ) {
            delete sections[ type ];
        } else {
            sections[ type ].sort();
        }
    }

    var types = Object.keys( sections );
    types.sort();

    return types.reduce( function ( output, type ) {
        var plural = sections[ type ].length > 1;
        output += '<h5>' + ( plural ? plurals[ type ] : type ) + '</h5>\n';
        output += '<ul>';
        output += sections[ type ].reduce( function ( output, path ) {
            output += '<li>' + makeLink( path ) + '</li>\n';
            return output;
        }, '' );
        output += '</ul>\n';
        return output;
    }, '' );
};

var renderBreadCrumbs = function ( input ) {
    var module = input.header.Module;
    return el( 'a', { href: pathToRoot + 'index.html#' + module }, [ module ]) +
        ' &rarr; ' + el( 'strong', [ input.header.File ] );
};

var renderIndex = function ( input ) {
    var modules = index.modules,
        parts = [],
        thisFile = input.header && input.header.File,
        module;
    for ( module in modules ) {
        parts.push( el( 'h5', [ module ] ) );
        parts.push( el( 'ul', modules[ module ].files.map( function ( file ) {
            return el( 'li', [
                ( file.name === thisFile ) ?
                    el( 'strong', [ file.name ] ) :
                    el( 'a', {
                        href: pathToRoot + file.docs,
                    }, [
                        file.name
                    ])
            ]);
        }) ) );
    }
    return el( 'div#index', parts );
};

var renderFullIndex = function () {
    var modules = index.modules,
        pathToFile = index.pathToFile,
        pathToType = index.pathToType,
        toLink = Object.keys( pathToFile );
    return el( 'div', Object.keys( modules ).map( function ( module, i, arr ) {
        var data = modules[ module ],
            files = data.files,
            moduleIndex = toLink.filter( function ( name ) {
                return files.some( function ( file ) {
                    return file.docs === pathToFile[ name ];
                });
            }),
            section = '';

        moduleIndex.sort( function ( a, b ) {
            if ( pathToType[ a ] < pathToType[ b ] ) {
                return -1;
            }
            if ( pathToType[ a ] > pathToType[ b ] ) {
                return 1;
            }
            return a < b ? -1 : a > b ? 1 : 0;
        });

        moduleIndex = moduleIndex.reduce( function ( prev, item ) {
            if ( pathToType[ item ] !== section ) {
                section = pathToType[ item ];
                prev.push( [] );
            }
            prev[ prev.length - 1 ].push( item );
            return prev;
        }, [] );

        return el( 'section', {
            id: module,
            style: 'z-index: ' + ( arr.length - i ) + ';'
        },[
            el( 'h2', [ module ]),
            renderText( data.description ),
            moduleIndex.map( function ( group ) {
                if ( pathToType[ group[0] ] !== 'Class' &&
                        pathToType[ group[0] ] !== 'Mixin' &&
                        pathToType[ group[0] ] !== 'Namespace' ) {
                    return '';
                }
                return el( 'h3', [
                    plurals[ pathToType[ group[0] ] ],
                ]) + el( 'ul', group.map( function ( name ) {
                    return el( 'li', [
                        el( 'a', {
                            href: pathToFile[ name ] + '#' + makeId( name )
                        }, [
                            name.replace( /([#\.\-])/g, '$1<wbr>' )
                        ])
                    ]);
                }) );
            }).join( '' )
        ]);
    }) );
};

// Usage: node write.js template.html input.json index.json output.html
( function () {
    index = JSON.parse( fs.readFileSync( process.argv[4], 'utf8' ) );

    var outputFileName = process.argv[5],
        input = JSON.parse( fs.readFileSync( process.argv[3], 'utf8' ) ),
        template = fs.readFileSync( process.argv[2], 'utf8' ),
        html = template.replace( /\{([A-Z]+)\}/g, function ( _, name ) {
            switch ( name ) {
                case 'TITLE':
                    pathToRoot = input.header.pathToRoot;
                    return input.header.File;
                case 'ROOT':
                    return pathToRoot;
                case 'BREADCRUMBS':
                    return renderBreadCrumbs( input );
                case 'SECTIONS':
                    return renderSections( input );
                case 'TOC':
                    return renderTOC( input );
                case 'INDEX':
                    return renderIndex( input );
                case 'FULLINDEX':
                    pathToRoot = '';
                    return renderFullIndex();
            }
            return '';
        });

    fs.writeFileSync( outputFileName, html );
}() );
