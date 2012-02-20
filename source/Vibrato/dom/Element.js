// -------------------------------------------------------------------------- \\
// File: Element.js                                                           \\
// Module: DOM                                                                \\
// Requires: Core, UA                                                         \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, window, document, Node */

"use strict";

/*
    Module: DOM
    
    The DOM module provides helper functions and classes for dealing with the
    DOM.
*/

( function ( NS, undefined ) {

/*
    Namespace: O.Element

    The O.Element namespace contains a number of helper functions for dealing
    with DOM elements.
*/
 
/*
    Property (private): Element-directProperties
    Type: Object
    
    Any names that match keys in this map will be set as direct properties
    rather than as attributes on the element.
*/
var directProperties = {
    'class': 'className',
    className: 'className',
    defaultValue: 'defaultValue',
    'for': 'htmlFor',
    html: 'innerHTML',
    text: 'textContent',
    unselectable: 'unselectable',
    value: 'value'
};

/*
    Property (private): Element-booleanProperties
    Type: Object
    
    Any names that match keys in this map will be set as direct properties and
    have their value converted to a boolean.
*/
var booleanProperties = {
    checked: 1,
    defaultChecked: 1,
    disabled: 1,
    multiple: 1,
    selected: 1
};

/*
    Property (private): Element-cssNoPx
    Type: Object
    
    Keys for CSS properties that take raw numbers as a value.
*/
var cssNoPx = {
    opacity: 1,
    zIndex: 1
};

/*
    Property (private): Element-styleNames
    Type: Object
    
    Map of normal CSS names to the name used on the style object.
*/
var styleNames = function () {
    var styles = NS.UA.cssProps,
        styleNames = {},
        property, style;
    for ( property in styles ) {
        style = styles[ property ];
        if ( style ) {
            style = style.camelCase();
            // Stupid MS, don't follow convention.
            if ( style.slice( 0, 2 ) === 'Ms' ) {
                style = 'm' + style.slice( 1 );
            }
            styleNames[ property ] = style;
        }
    }
    return styleNames;
}();

var setStyle = function ( el, style, value ) {
    if ( value !== undefined ) {
        style = ( styleNames[ style ] || style ).camelCase();
        if ( typeof value === 'number' && !cssNoPx[ style ] ) {
            value += 'px';
        }
        el.style[ style ] = value;
    }
    return el;
};

var setStyles = function ( el, styles ) {
    for ( var prop in styles ) {
        setStyle( el, prop, styles[ prop ] );
    }
    return el;
};

/*
    Method: Element#get
    
    Get a property or attribute of the element.
    
    Parameters:
        key - {String} The name of the property/attribute to get.
    
    Returns:
        {String|Boolean} The attribute or property.
*/
window.Element.prototype.get = function ( key ) {
    var prop = directProperties[ key ];
    return prop ?
        this[ prop ] :
    booleanProperties[ key ] ?
        !!this[ key ] :
        this.getAttribute( key );
};

/*
    Method: Element#set
    
    Sets a property or attribute on the element.
    
    Parameters:
        key   - {String} The name of the property/attribute to set.
        value - {String|Boolean} The value to set for that property.
    
    Returns:
        {Element} Returns self.
*/
window.Element.prototype.set = function ( key, value ) {
    var prop = directProperties[ key ];
    if ( prop ) {
        this[ prop ] = ( value == null ? '' : '' + value );
    } else if ( booleanProperties[ key ] ) {
        this[ key ] = !!value;
    } else if ( key === 'styles' ) {
        setStyles( this, value );
    } else if ( value == null ) {
        this.removeAttribute( key );
    } else {
        this.setAttribute( key, '' + value );
    }
    return this;
};
    
/*
    Property (private): O.Element-splitter
    Type: RegExp
    
    RegExp for splitting tag#id.class.class2 etc. into the different parts.
*/
var splitter = /(#|\.)/;

/*
    Property (private): O.Element-doc
    Type: Document
    
    A reference to the document object.
*/
var doc = document;

/*
    Property (private): O.Element-ieEventModel
    Type: Boolean
    
    Does the browser only support the IE event model?
*/
var ieEventModel = !!doc.addEventListener.isFake;

var DOCUMENT_POSITION_CONTAINED_BY = Node.DOCUMENT_POSITION_CONTAINED_BY;

var view = null;

var setAttributes, appendChildren, getPosition;

var create = function ( tag, props, children ) {
    
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
    if ( ieEventModel && ( tag === 'input' ||
            tag === 'select' || tag === 'textarea' ) ) {
        el.addEventListener( tag === 'select' ?
            'change' : 'propertychange', NS.RootViewController, false );
    }
    if ( props ) {
        setAttributes( el, props );
    }
    if ( children ) {
        appendChildren( el, children );
    }
    return el;
};

setAttributes = function ( el, props ) {
    var prop, value;
    for ( prop in props ) {
        value = props[ prop ];
        if ( value !== undefined ) {
            if ( value instanceof NS.Binding ) {
                value.to( prop, el ).connect();
                if ( view ) { view.registerBinding( value ); }
            } else {
                el.set( prop, value );
            }
        }
    }
    return el;
};

appendChildren = function ( el, children ) {
    var i, l, node;
    for ( i = 0, l = children.length; i < l; i += 1 ) {
        node = children[i];
        if ( node ) {
            if ( node instanceof Array ) {
                appendChildren( el, node );
            }
            else if ( node instanceof NS.View ) {
                view.insertView( node, el );
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

getPosition = function ( el, ancestor ) {
    var rect = el.getBoundingClientRect(),
        position = {
            top: rect.top,
            left: rect.left
        };
    while ( el = el.parentNode ) {
        position.top += el.scrollTop || 0;
        position.left += el.scrollLeft || 0;
    }
    if ( ancestor ) {
        rect = getPosition( ancestor );
        position.top -= rect.top;
        position.left -= rect.left;
    }
    return position;
};

var Element = {
    /*
        Function: O.Element.forView
        
        Sets the view to which newly created elements should be associated. This
        is used to associate bindings with a view and to add child views as
        subviews correctly. This is normally handled automatically by the render
        method in <O.View>, however should you need to use it manually it is
        important to store the previous view (returned by the method) and
        restore it when you are done creating elements for your view.
        
        Parameters:
            view - {(O.View|null)} The view to associate new/appended DOM
                   elements with.
        
        Returns:
            {(O.View|null)} The previous view DOM elements were associated with.
    */
    forView: function ( newView ) {
        var oldView = view;
        view = newView;
        return oldView;
    },
    
    /*
        Function: O.Element.create
        
        Creates and returns a new element, setting any supplied properties and
        appending any supplied children. If the browser event system doesn't
        support capturing (just IE<8), then this will also add an event listener
        for change and input events to any form elements.
        
        Parameters:
            tag      - {String} The tag name for the new class. You may also
                       specify class names and an id here using CSS syntax
                       (.class, #id). For example to create <span id="id"
                       class="class1 class2"></span> you could call:
                       O.Element.create('span#id.class1.class2');
            props    - {Object} (optional) The attributes to add to the element,
                       e.g. Element.create('input', { type: 'text' }); The
                       special attributes 'text' and 'html' allow you to set the
                       textual or html content of the element respectively.
            children - {Array.<Element|String>} (optional) An array of child
                       nodes and/or strings of text to append to the element.
                       Text nodes will be created for each string supplied. Null
                       or undefined values will simply be skipped.
        
        Returns:
            {Element} The new element.
    */
    create: create,
    
    /*
        Function: O.Element.setAttributes
        
        Sets each attribute in the hash on the given element.
        
        Parameters:
            el    - {Element} The element to set the attributes on.
            props - {Object} The attributes to add to the element.
                    e.g. `Element.create('input', { type: 'text' });`
                    The special attributes `'text'` and `'html'` allow you to
                    set the textual or html content of the element respectively.
        
        Returns:
            {Element} The element.
    */
    setAttributes: setAttributes,
    
    /*
        Function: O.Element.appendChildren
        
        Appends an array of children or views to an element
        
        Parameters:
            el       - {Element} The element to append to.
            children - {Array.<(Element|O.View)>} The children to append.
        
        Returns:
            {Element} The element.
    */
    appendChildren: appendChildren,
    
    /*
        Function: O.Element.hasClass
        
        Determines if an element has a particular class name.
        
        Parameters:
            el        - {Element} The element to test.
            className - {String} The class name to check.
        
        Returns:
            {Boolean} Does the element have the class?
    */
    hasClass: function ( el, className ) {
        return el.className.contains( className, ' ' );
    },
    
    /*
        Function: O.Element.addClass
        
        Adds a class to the element if not already there.
        
        Parameters:
            el        - {Element} The element to add the class to.
            className - {String} The class name to add.
        
        Returns:
            {O.Element} Returns self.
    */
    addClass: function ( el, className ){
        var current = el.className;
        if ( !current.contains( className, ' ' ) ) {
            el.className = ( current ? current + ' ' : '' ) + className;
        }
        return this;
    },
    
    /*
        Function: O.Element.removeClass
        
        Removes a class from the element if present.
        
        Parameters:
            el        - {Element} The element to remove the class from.
            className - {String} The class name to remove.
        
        Returns:
            {O.Element} Returns self.
    */
    removeClass: function ( el, className ) {
        var current = el.className,
            index = (' ' + current + ' ' ).indexOf( ' ' + className + ' ' );
        if ( index > -1 ) {
            el.className = current.slice( 0, index && index - 1 ) +
                           current.slice( index + className.length );
        }
        return this;
    },
    
    /*
        Function: O.Element.setStyle
    
        Sets a CSS style on the element.
        
        Parameters:
            el    - {Element} The element to set the style on.
            style - {String} The name of the style to set.
            value - {(String|Number)} The value to set the style to.
        
        Returns:
            {O.Element} Returns self.
    */
    setStyle: setStyle,
    
    /*
        Function: O.Element.setStyles
    
        Set a hash of CSS styles on the element.
        
        Parameters:
            el    - {Element} The element to set the style on.
            styles - {Object} A hash of styles/values to set.
        
        Returns:
            {O.Element} Returns self.
    */
    setStyles: setStyles,
    
    /*
        Function: O.Element.contains
        
        Tests whether one element is a descendent of or is the same node as
        another element.
        
        Parameters:
            el             - {Element} The element that might be the parent
                             element
            potentialChild - {Element} The element to test if it is the same as
                             or a descendent of the parent element.
        
        Returns:
            {Boolean} Is the second element equal to or a descendent of the
            first element?
    */
    contains: function ( el, potentialChild ) {
        var relation = el.compareDocumentPosition( potentialChild );
        return !relation || !!( relation & DOCUMENT_POSITION_CONTAINED_BY );
    },
    
    /*
        Function: O.Element.nearest
     
        Looks for the nearest element which is accepted by the test function or
        is of the element type given as the test string. The element given is
        tested first, then its parent, then its parent's parent etc.
        
        Parameters:
            el    - {Element} The element to start searching from.
            test  - {(String|Function)} If a function, this is called on each
                    successive element until one causes it to return a truthy
                    value. That element is then returned. If it is a string,
                    each element is instead checked to see if its nodeName is
                    the same as this string.
            limit - {Element} (optional) An element known to be higher in the
                    hierarchy than the desired element. If this is found in the
                    search path, a null result will be immediately be returned.
        
        Returns:
            {(Element|null)} The nearest matching element, or null if none
            matched.
    */
    nearest: function ( el, test, limit ) {
        if ( !limit ) { limit = el.ownerDocument.documentElement; }
        if ( typeof test === 'string' ) {
            var nodeName = test.toUpperCase();
            test = function ( el ) {
                return ( el.nodeName === nodeName );
            };
        }
        while ( el && !test( el ) ) {
            if ( !el || el === limit ) {
                return null;
            }
            el = el.parentNode;
        }
        return el;
    },
    
    /*
        Function: O.Element.getPosition
    
        Find the position of the top left corner of the element in pixels,
        relative either to the page as a whole or a supplied ancestor of the
        element.
        
        Parameters:
            el       - {Element} The element to determine the position of.
            ancestor - {Element} The top left corner of this element will be
                       treated as co-ordinates (0,0). This must be an ancestor
                       of the given element in the DOM tree.
        
        Returns:
            {Object} The offset in pixels of the element relative to the
            given ancestor or the whole page. Has two properties:
            `{ top: Number, left: Number }`.
    */
    getPosition: getPosition
};

NS.Element = Element;

}( O ) );