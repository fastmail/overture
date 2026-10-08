/*global DOMParser, Element, Node, document, HTMLButtonElement,
    HTMLFieldSetElement, HTMLInputElement, HTMLObjectElement, HTMLOutputElement,
    HTMLSelectElement, HTMLTextAreaElement */

// A <form> exposes its named controls as properties, shadowing any DOM
// method or property of the same name, and the document likewise exposes
// named elements. Until those names are stripped, use the prototype versions.
const getterFor = (constructor, name) =>
    Object.getOwnPropertyDescriptor(constructor.prototype, name).get;
const getNodeName = getterFor(Node, 'nodeName');
const getNamespaceURI = getterFor(Element, 'namespaceURI');
const getAttribute = Element.prototype.getAttribute;
const removeAttribute = Element.prototype.removeAttribute;
const getElementsByTagName = document.getElementsByTagName;

/**
    All untrusted HTML (i.e. anything that's not a static string we wrote) MUST go through HTMLDefanger before being inserted into the DOM. The defang method returns a DOM node or fragment, which you can append directly.

    DO NOT get the HTML return type and set it as innerHTML. While this should be safe in theory, in practice browsers may reparse it differently so you end up with a different (potentially dangerous) DOM tree. This is called mXSS. DOMPurify tries to fix the mXSS bugs it knows about; I prefer the safer option of never doing the operation that can lead to it in the first place. The HTML return type is only for serialising into record state.

    The _INERT return type returns DOM nodes that are still in the inert document and not imported. If you use this and then want to insert it into the document after further transformations you MUST use `document.importNode(...)` to safely import it; DO NOT use document.adoptNode (or omit importing it), as this may leave shadow roots in place that can contain unsanitised content.

    Any element's id becomes a property of window, shadowing any global that isn't defined yet, and an id, a label's `for` or a `usemap` can also reach the app's own elements once the output is in the document. The defanger only strips the ids and names that would shadow the document or a form while it works, so an onAttribute callback MUST prefix every id and idref (as jmapui's does) before the output goes anywhere near the live document.

    This defanger will strip all comments; they're not dangerous, just not necessary. If you have a usecase where you need them preserved, talk to neilj.

    It strips rather than attempting to defang MathML or SVG. It could be extended to do so if needed.

    Code initially based off DOMPurify https://github.com/cure53/DOMPurify/
*/

const TAGS_ALLOW = new Set([
    'A',
    'ABBR',
    'ACRONYM',
    'ADDRESS',
    'AREA',
    'ARTICLE',
    'ASIDE',
    'AUDIO',
    'B',
    'BDI',
    'BDO',
    'BIG',
    'BLINK',
    'BLOCKQUOTE',
    'BODY',
    'BR',
    'BUTTON',
    'CANVAS',
    'CAPTION',
    'CENTER',
    'CITE',
    'CODE',
    'COL',
    'COLGROUP',
    'CONTENT',
    'DATA',
    'DATALIST',
    'DD',
    'DECORATOR',
    'DEL',
    'DETAILS',
    'DFN',
    'DIR',
    'DIV',
    'DL',
    'DT',
    'ELEMENT',
    'EM',
    'FIELDSET',
    'FIGCAPTION',
    'FIGURE',
    'FONT',
    'FOOTER',
    'FORM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HEAD',
    'HEADER',
    'HGROUP',
    'HR',
    'HTML',
    'I',
    'IMG',
    'INPUT',
    'INS',
    'KBD',
    'LABEL',
    'LEGEND',
    'LI',
    'MAIN',
    'MAP',
    'MARK',
    'MARQUEE',
    'MENU',
    'MENUITEM',
    'METER',
    'NAV',
    'NOBR',
    'OL',
    'OPTGROUP',
    'OPTION',
    'OUTPUT',
    'P',
    'PICTURE',
    'PRE',
    'PROGRESS',
    'Q',
    'RP',
    'RT',
    'RUBY',
    'S',
    'SAMP',
    'SECTION',
    'SELECT',
    'SHADOW',
    'SMALL',
    'SOURCE',
    'SPACER',
    'SPAN',
    'STRIKE',
    'STRONG',
    'STYLE',
    'SUB',
    'SUMMARY',
    'SUP',
    'TABLE',
    'TBODY',
    'TD',
    'TEXTAREA',
    'TFOOT',
    'TH',
    'THEAD',
    'TIME',
    'TR',
    'TRACK',
    'TT',
    'U',
    'UL',
    'VAR',
    'VIDEO',
    'WBR',
]);

const TAGS_FORBID_CONTENTS = new Set([
    'AUDIO',
    'COLGROUP',
    'HEAD',
    'IFRAME',
    'NOEMBED',
    'NOFRAMES',
    'PLAINTEXT',
    'SCRIPT',
    'STYLE',
    'TEMPLATE',
    'THEAD',
    'TITLE',
    'VIDEO',
    'XMP',
]);

const TAGS_ALLOW_DATA_URI = new Set([
    'AUDIO',
    'VIDEO',
    'IMG',
    'SOURCE',
    'IMAGE',
]);

// ---

const ATTRS_ALLOW = new Set([
    'accept',
    'action',
    'align',
    'alt',
    'autocomplete',
    'background',
    'bgcolor',
    'border',
    'cellpadding',
    'cellspacing',
    'checked',
    'cite',
    'class',
    'clear',
    'color',
    'cols',
    'colspan',
    'controls',
    'coords',
    'crossorigin',
    'datetime',
    'default',
    'dir',
    'disabled',
    'download',
    'enctype',
    'face',
    'for',
    'headers',
    'height',
    'hidden',
    'high',
    'href',
    'hreflang',
    'id',
    'integrity',
    'ismap',
    'label',
    'lang',
    'list',
    'loop',
    'low',
    'max',
    'maxlength',
    'media',
    'method',
    'min',
    'minlength',
    'multiple',
    'name',
    'noshade',
    'novalidate',
    'nowrap',
    'open',
    'optimum',
    'pattern',
    'placeholder',
    'poster',
    'preload',
    'pubdate',
    'radiogroup',
    'readonly',
    'rel',
    'required',
    'rev',
    'reversed',
    'role',
    'rows',
    'rowspan',
    'spellcheck',
    'scope',
    'selected',
    'shape',
    'size',
    'sizes',
    'span',
    'srclang',
    'start',
    'src',
    'srcset',
    'step',
    'style',
    'summary',
    'tabindex',
    'target',
    'title',
    'type',
    'usemap',
    'valign',
    'value',
    'width',
    'xmlns',
]);

const ATTRS_INERT = new Set([
    'alt',
    'class',
    'for',
    'id',
    'label',
    'name',
    'pattern',
    'placeholder',
    'summary',
    'title',
    'value',
    'style',
    'xmlns',
]);

// ---

const ATTR_WHITESPACE =
    /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205f\u3000]/g;

const ATTR_SCRIPT_OR_DATA = /^(?:\w+script|data):/i;

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

// The app's document has properties for its own named forms and frames,
// which would make the check depend on what's on screen
const inertDocument = document.implementation.createHTMLDocument('');
const formElement = inertDocument.createElement('form');

// Elements whose name is a property of the document, and of window, so
// could shadow any global that isn't defined yet
const NAMED_BY_DOCUMENT = new Set(['EMBED', 'FORM', 'IFRAME', 'IMG', 'OBJECT']);

// Elements whose id or name is a property of the form they're in
const NAMED_BY_FORM = new Set([
    'BUTTON',
    'FIELDSET',
    'IMG',
    'INPUT',
    'OBJECT',
    'OUTPUT',
    'SELECT',
    'TEXTAREA',
]);

// A name on any other element, such as an <a> anchor, shadows nothing. An
// id is checked against the document too, as an <object>'s shadows it.
const isClobbering = (nodeName, name, value) => {
    if (name === 'name') {
        return (
            NAMED_BY_DOCUMENT.has(nodeName) ||
            (NAMED_BY_FORM.has(nodeName) && value in formElement)
        );
    }
    return value in inertDocument || value in formElement;
};

const isValidAttribute = function (nodeName, name, value, options) {
    // Allow valid data-* attributes: At least one character after "-"
    // https://html.spec.whatwg.org/multipage/dom.html#embedding-custom-non-visible-data-with-the-data-*-attributes
    // XML-compatible (https://html.spec.whatwg.org/multipage/infrastructure.html#xml-compatible and http://www.w3.org/TR/xml/#d0e804)
    // We don't need to check the value; it's always URI safe.
    if (options.attrAllowData && /^data-[\-\w.\u00B7-\uFFFF]/.test(name)) {
        return true;
    }
    if (options.attrAllowAria && /^aria-[\-\w]+$/.test(name)) {
        return true;
    }
    // Is the attribute allowed?
    if (
        !options.allowAttributes.has(name) ||
        options.forbidAttributes.has(name)
    ) {
        return false;
    }
    // Is the value safe?
    // Always for inert attributes
    if (ATTRS_INERT.has(name)) {
        return true;
    }
    value = value.replace(ATTR_WHITESPACE, '');
    // Keep image data URIs alive if src is allowed
    if (
        TAGS_ALLOW_DATA_URI.has(nodeName) &&
        (name === 'src' || name === 'href') &&
        value.startsWith('data:')
    ) {
        return true;
    }
    // Otherwise, make sure it's not a script or data URI
    if (!ATTR_SCRIPT_OR_DATA.test(value)) {
        return true;
    }

    return false;
};

const isAllowedAttribute = (node, nodeName, name, value, options) =>
    isValidAttribute(nodeName, name, value, options) &&
    options.onAttribute.every((fn) => fn(name, value, node, nodeName, options));

// The parser only makes unique, lowercase names, which getAttribute and
// removeAttribute can address. A callback using setAttributeNS could add
// others, which they can't. Most elements have only a few attributes, for
// which scanning the list is cheaper than making a Set.
const isAddressableByName = function (names) {
    if (!names.every((name) => name === name.toLowerCase())) {
        return false;
    }
    return names.length <= 16
        ? names.every((name, index) => names.indexOf(name) === index)
        : new Set(names).size === names.length;
};

const CLOBBERING_ATTRIBUTES = ['id', 'name'];

// If return value is false, kill node. If true, keep node.
const defangAttributes = function (node, nodeName, options) {
    // Going by name is much faster than through node.attributes, which
    // makes an object for each attribute
    const names = node.getAttributeNames();
    // This is way in excess of any reasonable number of attributes for a node.
    // Anything with this many attributes is malicious - trying to sanitise the
    // attributes individually is pathologically slow in browsers, which
    // presumably do not optimise for this!
    if (names.length > 256) {
        return false;
    }
    if (isAddressableByName(names)) {
        for (const name of names) {
            const value = node.getAttribute(name);
            // If null, an onAttribute callback has already removed it
            if (
                value !== null &&
                !isAllowedAttribute(node, nodeName, name, value, options)
            ) {
                node.removeAttribute(name);
            }
        }
    } else {
        for (const attr of Array.from(node.attributes)) {
            if (
                attr.ownerElement === node &&
                !isAllowedAttribute(
                    node,
                    nodeName,
                    attr.name.toLowerCase(),
                    attr.value,
                    options,
                )
            ) {
                node.removeAttributeNode(attr);
            }
        }
    }
    // Check the final values, as onAttribute callbacks may rewrite them
    for (const name of CLOBBERING_ATTRIBUTES) {
        const value = node.getAttribute(name);
        if (value !== null && isClobbering(nodeName, name, value)) {
            node.removeAttribute(name);
        }
    }
    return true;
};

// These shadow a property of their form by id. The parser can tie one to a
// form that isn't its ancestor, so ask the element which form it's in.
const FORM_GETTERS = {
    BUTTON: getterFor(HTMLButtonElement, 'form'),
    FIELDSET: getterFor(HTMLFieldSetElement, 'form'),
    INPUT: getterFor(HTMLInputElement, 'form'),
    OBJECT: getterFor(HTMLObjectElement, 'form'),
    OUTPUT: getterFor(HTMLOutputElement, 'form'),
    SELECT: getterFor(HTMLSelectElement, 'form'),
    TEXTAREA: getterFor(HTMLTextAreaElement, 'form'),
};

// An <img> can't say which form it's in, so it's in one if there are any.
// An <object> also shadows the document's properties, so it always counts.
const mayClobberById = function (element, nodeName, hasForm) {
    if (nodeName === 'IMG') {
        return hasForm;
    }
    const getForm = FORM_GETTERS[nodeName];
    return (
        !!getForm && (nodeName === 'OBJECT' || getForm.call(element) !== null)
    );
};

// The candidates: <svg> and <math>, the only ways the parser makes elements
// in another namespace, and the elements whose name or id can shadow the
// document or a form. isClobbering and mayClobberById decide.
const CLOBBERING_SELECTOR = [
    'svg',
    'math',
    ...[...new Set([...NAMED_BY_DOCUMENT, ...NAMED_BY_FORM])].map(
        (nodeName) => `${nodeName.toLowerCase()}[name]`,
    ),
    ...[...NAMED_BY_FORM].map((nodeName) => `${nodeName.toLowerCase()}[id]`),
].join(',');

// Runs before any callback, so they can use the document and its elements
// normally. It must not read any property of a form, or the form remembers
// the control it returned under that name even once the name is stripped.
// It also strips SVG and MathML, with their contents.
//
// A control's id shadows only its own form's properties, and callbacks on
// the root look ids up to inline and prune styles, so those ids stay on
// until the walk reaches a form, and callbacks on other elements mustn't
// read a property of a form. They're returned so the walk can take them
// off, and put each back on its control just before its own callbacks run,
// as those may rewrite it into something harmless, such as by prefixing it.
// An <object>'s id shadows the document, so comes off here for good.
const stripClobbering = function (root) {
    const ids = new Map();
    const hasForm = !!root.querySelector('form');
    for (const element of root.querySelectorAll(CLOBBERING_SELECTOR)) {
        if (getNamespaceURI.call(element) !== HTML_NAMESPACE) {
            element.remove();
            continue;
        }
        const nodeName = getNodeName.call(element);
        const id = getAttribute.call(element, 'id');
        if (
            id !== null &&
            isClobbering(nodeName, 'id', id) &&
            mayClobberById(element, nodeName, hasForm)
        ) {
            if (nodeName === 'OBJECT') {
                removeAttribute.call(element, 'id');
            } else {
                ids.set(element, id);
            }
        }
        const name = getAttribute.call(element, 'name');
        if (name !== null && isClobbering(nodeName, 'name', name)) {
            removeAttribute.call(element, 'name');
        }
    }
    return ids;
};

// ---

// If return value is false, kill node. If true, keep node.
const defangElement = function (node, nodeName, options) {
    if (node.nodeType === 8 /* COMMENT_NODE */) {
        return false;
    }
    if (!options.onElement.every((fn) => fn(node, nodeName, options))) {
        return false;
    }
    if (!options.allowTags.has(nodeName) || options.forbidTags.has(nodeName)) {
        if (!TAGS_FORBID_CONTENTS.has(nodeName)) {
            // Unwrap at the DOM level; serialize+reparse is mXSS-prone. The
            // root's children can't go in the document, and the root is
            // kept anyway.
            const parent = node.parentNode;
            if (parent?.nodeType === 1 /* ELEMENT_NODE */) {
                const after = node.nextSibling;
                let child;
                while ((child = node.firstChild)) {
                    parent.insertBefore(child, after);
                }
            }
        }
        return false;
    }
    return true;
};

// Removing attributes one by one is pathologically slow, so this replaces
// the element with a copy without them.
const replaceWithBare = function (element) {
    const bare = element.ownerDocument.createElement(element.nodeName);
    let child;
    while ((child = element.firstChild)) {
        bare.appendChild(child);
    }
    element.parentNode.replaceChild(bare, element);
    return bare;
};

// ---

const DOM = 1;
const FRAGMENT = 2;
const HTML = 4;
const INERT = 8;
const DOM_INERT = DOM | INERT;
const FRAGMENT_INERT = FRAGMENT | INERT;

class HTMLDefanger {
    constructor(mixin) {
        this.allowTags = TAGS_ALLOW;
        this.forbidTags = new Set();
        this.allowAttributes = ATTRS_ALLOW;
        this.forbidAttributes = new Set();
        this.attrAllowData = false;
        this.attrAllowAria = true;
        this.onElement = [];
        this.onAttribute = [];
        this.returnType = DOM;
        Object.assign(this, mixin);
    }

    defang(html, returnType) {
        let doc = null;
        try {
            doc = new DOMParser().parseFromString(html, 'text/html');
        } catch (error) {}
        let documentElement = doc
            ? getElementsByTagName.call(doc, 'html')[0]
            : null;
        if (!documentElement) {
            doc = document.implementation.createHTMLDocument('');
            documentElement = doc.documentElement;
        }
        const clobberingIds = stripClobbering(documentElement);
        // Removing the root or body would blank the message, so swap in a
        // fresh element for one with too many attributes, keeping its content
        if (documentElement.getAttributeNames().length > 256) {
            documentElement = replaceWithBare(documentElement);
        }
        if (doc.body && doc.body.getAttributeNames().length > 256) {
            replaceWithBare(doc.body);
        }
        const nodeIterator = doc.createNodeIterator(
            documentElement,
            129, // NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_COMMENT
        );
        let idsStripped = false;
        let baseNode = null;
        let currentNode;
        while ((currentNode = nodeIterator.nextNode())) {
            // A form's nodeName may be shadowed until its controls' ids are
            // taken off
            const nodeName = getNodeName.call(currentNode);
            if (nodeName === 'FORM') {
                // Once off, an id stays off until its control is reached,
                // so this happens once
                if (!idsStripped) {
                    for (const element of clobberingIds.keys()) {
                        removeAttribute.call(element, 'id');
                    }
                    idsStripped = true;
                }
            } else if (idsStripped) {
                const id = clobberingIds.get(currentNode);
                if (id !== undefined) {
                    currentNode.setAttribute('id', id);
                }
            }
            if (
                !defangElement(currentNode, nodeName, this) ||
                !defangAttributes(currentNode, nodeName, this)
            ) {
                // Removing the root would leave nothing to return
                if (currentNode === documentElement) {
                    for (const attr of Array.from(currentNode.attributes)) {
                        currentNode.removeAttributeNode(attr);
                    }
                    continue;
                }
                if (!baseNode && nodeName === 'BASE') {
                    baseNode = currentNode;
                } else {
                    currentNode.remove();
                }
                continue;
            }
        }
        if (baseNode) {
            baseNode.remove();
        }
        if (!doc.body) {
            documentElement.appendChild(doc.createElement('body'));
        }
        if (returnType === undefined) {
            returnType = this.returnType;
        }
        if (returnType === HTML) {
            return doc.body.innerHTML;
        }
        if (returnType & FRAGMENT) {
            const frag = doc.createDocumentFragment();
            const body = doc.body;
            while (body.firstChild) {
                frag.appendChild(body.firstChild);
            }
            return returnType === FRAGMENT_INERT
                ? frag
                : document.importNode(frag, true);
        }

        return returnType === DOM_INERT
            ? documentElement
            : document.importNode(documentElement, true);
    }
}

// ---

export { HTMLDefanger, DOM, FRAGMENT, HTML, DOM_INERT, FRAGMENT_INERT };
