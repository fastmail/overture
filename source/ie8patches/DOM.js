// -------------------------------------------------------------------------- \\
// File: DOM.js                                                               \\
// Module: IEPatches                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global document, Element, HTMLInputElement, HTMLTextAreaElement */
/*jshint strict: false */

( function ( doc ) {

// Add defaultView property to document
var window = doc.defaultView = doc.parentWindow;

// Add JS hook
window.ie = 8;

// Add CSS hook
doc.documentElement.id = 'ie8';

// === Fake W3C events support ===

var translate = {
    focus: 'focusin',
    blur: 'focusout'
};

var toCopy = 'altKey ctrlKey metaKey shiftKey clientX clientY charCode keyCode'.split( ' ' );

function DOMEvent ( event ) {
    var type = event.type,
        doc = document,
        target = event.srcElement || doc,
        html = ( target.ownerDocument || doc ).documentElement,
        l = toCopy.length,
        property;

    while ( l-- ) {
        property = toCopy[l];
        this[ property ] = event[ property ];
    }

    if ( type === 'propertychange' ) {
        type = ( target.nodeName === 'INPUT' &&
                target.type !== 'text' && target.type !== 'password' ) ?
            'change' : 'input';
    }

    this.type = Object.keyOf( translate, type ) || type;
    this.target = target;
    this.pageX = event.clientX + html.scrollLeft;
    this.pageY = event.clientY + html.scrollTop;

    if ( event.button ) {
        this.button = ( event.button & 4 ? 1 :
            ( event.button & 2 ? 2 : 0 ) );
        this.which = this.button + 1;
    }

    this.relatedTarget = event.fromElement === target ?
        event.toElement : event.fromElement;
    this._event = event;
}

DOMEvent.prototype.isEvent = true;
DOMEvent.prototype.preventDefault = function () {
    this.defaultPrevented = true;
    this._event.returnValue = false;
};
DOMEvent.prototype.stopPropagation = function () {
    this._event.cancelBubble = true;
};
DOMEvent.prototype.defaultPrevented = false;

var addEventListener = function ( type, handler/*, capture */) {
    var fn = handler._ie_handleEvent ||
            ( handler._ie_handleEvent = function () {
        var event = new DOMEvent( window.event );
        if ( typeof handler === 'object' ) {
            handler.handleEvent( event );
        } else {
            handler.call( this, event );
        }
    });
    handler._ie_registeredCount =
        ( handler._ie_registeredCount || 0 ) + 1;
    this.attachEvent( 'on' + ( translate[ type ] || type ), fn );
};
addEventListener.isFake = true;

var removeEventListener = function ( type, handler/*, capture */) {
    var fn = handler._ie_handleEvent;
    if ( !( handler._ie_registeredCount -= 1 ) ) {
        delete handler._ie_handleEvent;
    }
    if ( fn ) {
        this.detachEvent( 'on' + ( translate[ type ] || type ), fn );
    }
};
removeEventListener.isFake = true;

doc.addEventListener = addEventListener;
doc.removeEventListener = removeEventListener;
window.addEventListener = addEventListener;
window.removeEventListener = removeEventListener;
Element.prototype.addEventListener = addEventListener;
Element.prototype.removeEventListener = removeEventListener;

// === Add textContent property to elements ===

Object.defineProperty( Element.prototype, 'textContent', {
    get: function () {
        return this.innerText;
    },

    set: function ( text ) {
        this.innerText = text;
    }
});

// === Add text selection methods and properties ===

function stripCr ( string ) {
    return string.split( '\r' ).join( '' );
}

// Taken from http://the-stickman.com/web-development/javascript/
// finding-selection-cursor-position-in-a-textarea-in-internet-explorer/
// and modified to work with textareas + input[type=text]
function getSelection ( el ) {
    // The current selection and a dummy duplicate
    var range = document.selection.createRange(),
        dummy = range.duplicate();

    // Select all text
    if ( el.nodeName === 'TEXTAREA' ) {
        dummy.moveToElementText( el );
    }
    else {
        dummy.expand( 'textedit' );
    }

    // Move dummy range end point to end point of original range
    dummy.setEndPoint( 'EndToEnd', range );

    // Now we can calculate start and end points
    var rangeLength = stripCr( range.text ).length,
        start = stripCr( dummy.text ).length - rangeLength,
        end = start + rangeLength;

    return { start: start, end: end };
}
var getSelectionStart = {
    get: function () {
        return getSelection( this ).start;
    }
};
var getSelectionEnd = {
    get: function () {
        return getSelection( this ).end;
    }
};

Object.defineProperty(
    HTMLInputElement.prototype, 'selectionStart', getSelectionStart );
Object.defineProperty(
    HTMLInputElement.prototype, 'selectionEnd',  getSelectionEnd );
Object.defineProperty(
    HTMLTextAreaElement.prototype, 'selectionStart', getSelectionStart );
Object.defineProperty(
    HTMLTextAreaElement.prototype, 'selectionEnd',  getSelectionEnd );

HTMLInputElement.prototype.setSelectionRange =
HTMLTextAreaElement.prototype.setSelectionRange = function ( start, end ) {
    var range = this.createTextRange();
    range.collapse( true );
    range.moveEnd( 'character', end || start || 0 );
    range.moveStart( 'character', start || 0 );
    range.select();
};

Object.defineProperty( Element.prototype, 'previousElementSibling', {
    get: function () {
        var node = this;
        do {
            node = node.previousSibling;
        } while ( node && node.nodeType !== 1 );
        return node;
    }
});
Object.defineProperty( Element.prototype, 'nextElementSibling', {
    get: function () {
        var node = this;
        do {
            node = node.nextSibling;
        } while ( node && node.nodeType !== 1 );
        return node;
    }
});

// === Node constants ===

window.Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
    DOCUMENT_NODE: 9,
    DOCUMENT_POSITION_DISCONNECTED: 1,
    DOCUMENT_POSITION_PRECEDING: 2,
    DOCUMENT_POSITION_FOLLOWING: 4,
    DOCUMENT_POSITION_CONTAINS: 8,
    DOCUMENT_POSITION_CONTAINED_BY: 16
};

// === Element#compareDocumentPosition ===

Element.prototype.compareDocumentPosition = function ( b ) {
    var a = this,
        different = ( a !== b ),
        aIndex = a.sourceIndex,
        bIndex = b.sourceIndex;

    return ( different && a.contains( b ) ? 16 : 0 ) +
        ( different && b.contains( a ) ? 8 : 0 ) +
        ( aIndex < bIndex ? 4 : 0 ) +
        ( bIndex < aIndex ? 2 : 0 );
};

}( document ) );
