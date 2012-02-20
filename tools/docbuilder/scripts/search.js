/*global document, setTimeout, location, Element, index */

"use strict";

( function () {
    
var escapeRegExp = function ( string ) {
    return string.replace( /([\-.*+?\^${}()|\[\]\/\\])/g, '\\$1' );
};

var numberToKey = {
    '13': 'enter',
    '38': 'up',
    '40': 'down',
    '37': 'left',
    '39': 'right',
    '27': 'esc',
    '32': 'space',
    '8': 'backspace',
    '9': 'tab',
    '46': 'delete',
    '33': 'pageup',
    '34': 'pagedown',
    '35': 'end',
    '36': 'home',
    '16': 'shift',
    '17': 'control',
    '18': 'alt',
    '20': 'capslock',
    '144': 'numlock'
};

var lookupKey = function ( event, noModifiers ) {
    var code = event.keyCode || event.which,
        preferAsci = code > 32 && event.type === 'keypress' &&
            event.which !== 0 && event.charCode !== 0,
        str = String.fromCharCode( code ).toLowerCase(),
        key = ( !preferAsci && numberToKey[ code ] ) || str;
    
    // Function keys
    if ( !preferAsci && 111 < code && code < 124 ) {
        key = 'f' + ( code - 111 );
    }
    // Append modifiers (use alphabetical order)
    var modifiers = '';
    if ( !noModifiers ) {
        if ( event.altKey ) { modifiers += 'alt-'; }
        if ( event.ctrlKey ) { modifiers += 'ctrl-'; }
        if ( event.metaKey ) { modifiers += 'meta-'; }
        if ( event.shiftKey ) { modifiers += 'shift-'; }
    }
    
    return modifiers + key;
};

var doc = document;
var splitter = /(#|\.)/;

var directProperties = {
    'class': 'className',
    className: 'className',
    defaultValue: 'defaultValue',
    'for': 'htmlFor',
    html: 'innerHTML',
    text: 'textContent',
    value: 'value'
};

var booleanProperties = {
    checked: 1,
    defaultChecked: 1,
    disabled: 1,
    multiple: 1,
    selected: 1
};

var appendChildren = function ( el, children ) {
    var i, l, node;
    for ( i = 0, l = children.length; i < l; i += 1 ) {
        node = children[i];
        if ( node ) {
            if ( node instanceof Array ) {
                appendChildren( el, node );
            } else {
                if ( typeof node === 'string' ) {
                    node = doc.createTextNode( node );
                }
                el.appendChild( node );
            }
        }
    }
    return el;
};

var el = function ( tag, props, children ) {
    
    if ( props instanceof Array ) {
        children = props;
        props = null;
    }
    
    var i, j, l;
    
    if ( splitter.test( tag ) ) {
        var parts = tag.split( splitter ),
            name;
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
    
    var el = doc.createElement( tag );

    if ( props ) {
        var key, value, prop;
        for ( key in props ) {
            value = props[ key ];
            prop = directProperties[ key ];
            if ( prop ) {
                el[ prop ] = ( value == null ? '' : '' + value );
            } else if ( booleanProperties[ key ] ) {
                el[ key ] = !!value;
            } else if ( value == null ) {
                el.removeAttribute( key );
            } else {
                el.setAttribute( key, '' + value );
            }
        }
    }
    if ( children ) {
        appendChildren( el, children );
    }
    return el;
};

// -- Begin search code --

var input = document.querySelector( '#search input' );
var results = document.getElementById( 'searchResults' );

var inFocus = false,
    inHover = false;

var hide = function () {
    results.className = 'menu';
};

var show = function () {
    results.className = 'menu show';
};

var makeId = function ( path ) {
    return path.replace( /[#.]/g, '_' );
};

var displayed = [];
var selected = -1;
var pathToRoot = document.querySelector( '.noDivide' ) ? '' : '../';

var focus = function ( dir ) {
    var node = displayed[ selected ];
    if ( node ) {
        node.className = 'result';
    }
    selected = ( selected + dir ) % displayed.length;
    if ( selected < 0 ) { selected = displayed.length + selected; }
    
    node = displayed[ selected ];
    if ( node ) {
        node.className = 'result selected';
    }
};

results.addEventListener( 'mouseover', function () {
    inHover = true;
}, false );

results.addEventListener( 'mouseout', function ( event ) {
    var really = true,
        node = event.relatedTarget;
    
    while ( node ) {
        if ( node === results ) {
            really = false;
            break;
        }
        node = node.parentNode;
    }
    if ( really ) {
        inHover = false;
        if ( !inFocus ) {
            hide();
        }
    }
}, false );

input.addEventListener( 'blur', function () {
    inFocus = false;
    if ( !inHover ) {
        hide();
    }
}, false );

input.addEventListener( 'focus', function () {
    inFocus = true;
    show();
}, false );

input.addEventListener( 'input', function () {
    var value = input.value.split( ' ' ),
        patterns = value.map( function ( token ) {
            return new RegExp( '(?:^|\\W)' + escapeRegExp( token ), 'i' );
        }),
        output;
    
    displayed = [];
    
    if ( value ) {
        output = el( 'ul' );

        var matches = index.filter( function ( obj ) {
            return patterns.every( function ( pattern ) {
                return pattern.test( obj.name );
            });
        });
        
        if ( !matches.length ) {
            output.appendChild( el( 'li.none' , {
                text: 'No results'
            }) );
            selected = -1;
        }

        for ( var i = 0, l = matches.length; i < l; i += 1 ) {
            var match = matches[ i ];
            if ( i < 10 ) {
                var li = el( 'li.result' + ( i ? '' : '.selected'), [
                    el( 'a', {
                        href: pathToRoot + match.path + '#' +
                            makeId( match.name ),
                        text: match.name
                    })
                ]);
                displayed.push( li );
                output.appendChild( li );
            } else {
                output.appendChild( el( 'li.more', {
                    text: 'and ' + ( l - i + 1 ) + ' more…'
                }) );
                break;
            }
            selected = 0;
        }
    } else {
        output = el( 'div.type', {
            text: 'Type to search'
        });
        selected = -1;
    }
    results.firstChild.replaceChild( output, results.firstChild.firstChild );
}, false );

input.addEventListener( 'keydown', function ( event ) {
    switch ( lookupKey( event ) ) {
        case 'down':
            focus( 1 );
            break;
        case 'up':
            focus( -1 );
            break;
        case 'enter':
            if ( selected > -1 ) {
                location.href = displayed[ selected ].querySelector( 'a' ).href;
            }
            break;
        case 'esc':
            input.blur();
            break;
    }
}, false );

doc.addEventListener( 'keydown', function ( event ) {
    if ( lookupKey( event ) === 'f' ) {
        setTimeout( function () { input.focus(); }, 0 );
    }
}, false );

}() );