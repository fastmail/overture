/*global window, document, Element, SVGAnimatedString */

import { Binding } from '../_codependent/_Binding.js';
import { View } from '../_codependent/_View.js';
import { didError } from '../foundation/RunLoop.js';
import { browser } from '../ua/UA.js';
import { ViewEventsController } from '../views/ViewEventsController.js';

import '../core/String.js'; // For String#camelCase, #hyphenate

/**
    Module: DOM

    The DOM module provides helper functions and classes for dealing with the
    DOM.
*/

/**
    Namespace: O.Element

    The O.Element namespace contains a number of helper functions for dealing
    with DOM elements.
*/

/**
    Property (private): Element-directProperties
    Type: Object

    Any names that match keys in this map will be set as direct properties
    rather than as attributes on the element.
*/
const directProperties = {
    // Note: SVGElement#className is an SVGAnimatedString.
    class: 'className',
    className: 'className',
    defaultValue: 'defaultValue',
    for: 'htmlFor',
    html: 'innerHTML',
    text: 'textContent',
    unselectable: 'unselectable',
    value: 'value',
};

/**
    Property (private): Element-svgTagNames
    Type: Set

    When creating inline SVG elements the SVG namespace must be used. This list
    allows `Element.create` to handle SVG tag names transparently.

    Note that `title` is included in this, because we don’t expect Overture to
    ever be creating HTML `<title>` elements.

    Note that SVG attributes don’t use a namespace; only the element needs it.
    That simplifies things a bit.
*/
// I took this list from html.vim; it probably covers SVG 1.1 completely.
const svgTagNames = new Set([
    'svg',
    'altGlyph',
    'altGlyphDef',
    'altGlyphItem',
    'animate',
    'animateColor',
    'animateMotion',
    'animateTransform',
    'circle',
    'ellipse',
    'rect',
    'line',
    'polyline',
    'polygon',
    'image',
    'path',
    'clipPath',
    'color-profile',
    'cursor',
    'defs',
    'desc',
    'g',
    'symbol',
    'view',
    'use',
    'switch',
    'foreignObject',
    'filter',
    'feBlend',
    'feColorMatrix',
    'feComponentTransfer',
    'feComposite',
    'feConvolveMatrix',
    'feDiffuseLighting',
    'feDisplacementMap',
    'feDistantLight',
    'feFlood',
    'feFuncA',
    'feFuncB',
    'feFuncG',
    'feFuncR',
    'feGaussianBlur',
    'feImage',
    'feMerge',
    'feMergeNode',
    'feMorphology',
    'feOffset',
    'fePointLight',
    'feSpecularLighting',
    'feSpotLight',
    'feTile',
    'feTurbulence',
    'font',
    'font-face',
    'font-face-format',
    'font-face-name',
    'font-face-src',
    'font-face-uri',
    'glyph',
    'glyphRef',
    'hkern',
    'linearGradient',
    'marker',
    'mask',
    'pattern',
    'radialGradient',
    'set',
    'stop',
    'missing-glyph',
    'mpath',
    'text',
    'textPath',
    'tref',
    'tspan',
    'vkern',
    'metadata',
    'title',
]);

/**
    Property (private): Element-svgNS
    Type: String

    The URL for the SVG XML namespace.
*/
const svgNS = 'http://www.w3.org/2000/svg';

/**
    Property (private): Element-booleanProperties
    Type: Object

    Any names that match keys in this map will be set as direct properties and
    have their value converted to a boolean.
*/
const booleanProperties = {
    autofocus: 1,
    checked: 1,
    defaultChecked: 1,
    disabled: 1,
    hidden: 1,
    indeterminate: 1,
    multiple: 1,
    readOnly: 1,
    required: 1,
    selected: 1,
    webkitdirectory: 1,
};

/**
    Property (private): Element-cssNoPx
    Type: Object

    Keys for CSS properties that take raw numbers as a value.
*/
const cssNoPx = {
    opacity: 1,
    zIndex: 1,
};

/**
    Property (private): Element-styleNames
    Type: Object

    Map of normal CSS names to the name used on the style object.
*/
const styleNames = {
    float: 'cssFloat',
};

// In times gone by, we had various properties that needed to be prefixed; now
// it’s down to just user-select. This makes me happy. Hence no for loop.
let userSelectProperty = 'user-select';
{
    const style = document.createElement('div').style;
    style.cssText = 'user-select:none';
    if (!style.length) {
        if (browser === 'firefox') {
            userSelectProperty = '-moz-user-select';
            styleNames.userSelect = 'MozUserSelect';
        } else if (browser === 'msie') {
            userSelectProperty = '-ms-user-select';
            styleNames.userSelect = 'msUserSelect';
        } else {
            userSelectProperty = '-webkit-user-select';
            styleNames.userSelect = 'WebkitUserSelect';
        }
    }
}

/**
    Property (private): O.Element-doc
    Type: Document

    A reference to the document object.
*/
const doc = document;

// = Node.DOCUMENT_POSITION_CONTAINED_BY
const DOCUMENT_POSITION_CONTAINED_BY = 16;

let view = null;

/**
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
const forView = function (newView) {
    const oldView = view;
    view = newView;
    return oldView;
};

/**
    Function: O.Element.setAttributes

    Sets each attribute in the object on the given element.

    Parameters:
        el    - {Element} The element to set the attributes on.
        props - {Object} The attributes to add to the element.
                e.g. `Element.create('input', { type: 'text' });`
                The special attributes `'text'` and `'html'` allow you to
                set the textual or html content of the element respectively.

    Returns:
        {Element} The element.
*/
const setAttributes = function (el, props) {
    const currentView = view;
    for (const prop in props) {
        const value = props[prop];
        if (value === undefined) {
            continue;
        }
        if (prop.startsWith('on')) {
            el.addEventListener(prop.slice(2), (event) => {
                ViewEventsController.handleEvent(
                    event,
                    currentView,
                    null,
                    value,
                );
                event.stopPropagation();
            });
            continue;
        }
        if (Binding && value instanceof Binding) {
            value.to(prop, el).connect();
            if (currentView) {
                currentView.registerBinding(value);
            }
            continue;
        }
        el.set(prop, value);
    }
    return el;
};

/**
    Function: O.Element.appendChildren

    Appends an array of children or views to an element

    Parameters:
        el       - {Element} The element to append to.
        children - {(Element|O.View)[]} The children to append.

    Returns:
        {Element} The element.
*/
const appendChildren = function (el, children) {
    if (!(children instanceof Array)) {
        children = [children];
    }
    for (let i = 0, l = children.length; i < l; i += 1) {
        let node = children[i];
        if (node) {
            if (node instanceof Array) {
                appendChildren(el, node);
            } else if (View && node instanceof View) {
                view.insertView(node, el);
            } else {
                if (typeof node !== 'object') {
                    node = doc.createTextNode(node);
                }
                el.appendChild(node);
            }
        }
    }
    return el;
};

/**
    Function: O.Element.create

    Creates and returns a new element, setting any supplied properties and
    appending any supplied children.

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
        children - {(Element|String)[]} (optional) An array of child nodes
                   and/or strings of text to append to the element.
                   Text nodes will be created for each string supplied. Null
                   or undefined values will simply be skipped.

    Returns:
        {Element} The new element.
*/
const create = function (tag, props, children) {
    if (props instanceof Array) {
        children = props;
        props = null;
    }

    // Parse id/class names out of tag.
    if (/[#.]/.test(tag)) {
        const parts = tag.split(/([#.])/);
        tag = parts[0];
        if (!props) {
            props = {};
        }
        const l = parts.length;
        for (let i = 1; i + 1 < l; i += 2) {
            const name = parts[i + 1];
            if (parts[i] === '#') {
                props.id = name;
            } else {
                props.className = props.className
                    ? props.className + ' ' + name
                    : name;
            }
        }
    }

    // Create element with default or SVG namespace, as appropriate.
    const el = svgTagNames.has(tag)
        ? doc.createElementNS(svgNS, tag)
        : doc.createElement(tag);

    if (props) {
        setAttributes(el, props);
    }
    if (children) {
        appendChildren(el, children);
    }
    return el;
};

/**
    Function: O.Element.getStyle

    Gets the value of a CSS style on the element.

    Parameters:
        el    - {Element} The element to get the style from.
        style - {String} The name of the style to get.

    Returns:
        {String} Returns the style value.
*/
const getStyle = function (el, style) {
    return window.getComputedStyle(el).getPropertyValue(style);
};

/**
    Function: O.Element.setStyle

    Sets a CSS style on the element.

    Parameters:
        el    - {Element} The element to set the style on.
        style - {String} The name of the style to set.
        value - {(String|Number)} The value to set the style to.

    Returns:
        {O.Element} Returns self.
*/
const setStyle = function (el, style, value) {
    if (value !== undefined) {
        style = style.camelCase();
        style = styleNames[style] || style;
        if (typeof value === 'number' && !cssNoPx[style]) {
            value += 'px';
        }
        // IE will throw an error if you try to set an invalid value for a
        // style.
        try {
            el.style[style] = value;
        } catch (error) {
            didError({
                name: 'Element#setStyle',
                message: 'Invalid value set',
                details:
                    'Style: ' +
                    style +
                    '\nValue: ' +
                    value +
                    '\nEl id: ' +
                    el.id +
                    '\nEl class: ' +
                    el.className,
            });
        }
    }
    return this;
};

/**
    Function: O.Element.setStyles

    Set a collection of CSS styles on the element.

    Parameters:
        el    - {Element} The element to set the style on.
        styles - {Object} A map of styles->values to set.

    Returns:
        {O.Element} Returns self.
*/
const setStyles = function (el, styles) {
    for (const prop in styles) {
        setStyle(el, prop, styles[prop]);
    }
    return this;
};

/**
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
const contains = function (el, potentialChild) {
    const relation = el.compareDocumentPosition(potentialChild);
    return !relation || !!(relation & DOCUMENT_POSITION_CONTAINED_BY);
};

/**
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
const nearest = function (el, test, limit) {
    if (!limit) {
        limit = el.ownerDocument.documentElement;
    }
    if (typeof test === 'string') {
        const nodeName = test.toUpperCase();
        test = (node) => node.nodeName === nodeName;
    }
    while (el && !test(el)) {
        if (!el || el === limit) {
            return null;
        }
        el = el.parentNode;
    }
    return el;
};

/**
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
        given ancestor or the whole page, plus the height and width.
        Has four properties:

        - top: `Number`
        - left: `Number`
        - width: `Number`
        - height: `Number`
*/
const getPosition = function (el, ancestor) {
    let rect = el.getBoundingClientRect();
    const position = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
    };
    if (ancestor) {
        rect = getPosition(ancestor);
        if (ancestor.nodeName === 'BODY') {
            // document.documentElement - use of
            // body.scroll(Top|Left) is deprecated.
            ancestor = ancestor.parentNode;
        }
        position.top -= rect.top - ancestor.scrollTop;
        position.left -= rect.left - ancestor.scrollLeft;
    }
    return position;
};

/**
    Method: Element#get

    Get a property or attribute of the element.

    Parameters:
        key - {String} The name of the property/attribute to get.

    Returns:
        {String|Boolean} The attribute or property.
*/
Element.prototype.get = function (key) {
    const prop = directProperties[key];
    if (prop) {
        const value = this[prop];
        return value instanceof SVGAnimatedString ? value.animVal : value;
    }
    return booleanProperties[key] ? !!this[key] : this.getAttribute(key);
};

/**
    Method: Element#set

    Sets a property or attribute on the element.

    Parameters:
        key   - {String} The name of the property/attribute to set.
        value - {String|Boolean} The value to set for that property.

    Returns:
        {Element} Returns self.
*/
Element.prototype.set = function (key, value) {
    const prop = directProperties[key];
    if (prop) {
        const currentValue = this[prop];
        value = value == null ? '' : '' + value;
        if (currentValue instanceof SVGAnimatedString) {
            currentValue.baseVal = value;
        } else {
            this[prop] = value;
        }
    } else if (booleanProperties[key]) {
        this[key] = !!value;
    } else if (key === 'styles') {
        setStyles(this, value);
    } else if (key === 'children') {
        let child;
        while ((child = this.lastChild)) {
            this.removeChild(child);
        }
        appendChildren(this, value);
    } else if (value == null) {
        this.removeAttribute(key);
    } else if (key === '+class') {
        // IE doesn't support classList on SVGs
        // this.classList.add(...value.split(/[ .]/));
        this.set('class', this.get('class') + ' ' + value);
    } else {
        this.setAttribute(key, '' + value);
    }
    return this;
};

/**
    Function: O.Element.getAncestors

    Gets an array of all the elements ancestors, including itself.

    Parameters:
        el - {Element} The element whose ancestors will be returned.

    Returns:
        {Element[]} An array of elements.
*/
const getAncestors = function (el) {
    const ancestors = [];
    while (el) {
        ancestors.push(el);
        el = el.parentElement;
    }
    return ancestors.reverse();
};

/**
    Function: O.Element.cssStringFromKeyValue

    Converts an object into a String of 'key:value' pairs, delimited by ';'.
    Keys are converted from camel case to hyphenated format and numerical
    values are converted to strings with a 'px' suffix.

    Parameters:
        object - {Object} The object of CSS properties.

    Returns:
        {String} The CSS string.
*/
const cssStringFromKeyValue = function (object) {
    let result = '';
    for (let key in object) {
        let value = object[key];
        if (value !== undefined) {
            if (typeof value === 'number' && !cssNoPx[key]) {
                value += 'px';
            }
            key = key.hyphenate();
            if (key === 'user-select') {
                key = userSelectProperty;
            }
            result += key;
            result += ':';
            result += value;
            result += ';';
        }
    }
    return result;
};

export {
    forView,
    create,
    setAttributes,
    appendChildren,
    getStyle,
    setStyle,
    setStyles,
    contains,
    nearest,
    getPosition,
    getAncestors,
    cssStringFromKeyValue,
};

// TODO(cmorgan/modulify): do something about these exports:
// Element#get, Element#set
