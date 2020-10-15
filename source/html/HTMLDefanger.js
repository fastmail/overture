/*global DOMParser, window, document, navigator */

const NamedNodeMap = window.NamedNodeMap || window.MozNamedAttrMap;

/**
    All untrusted HTML (i.e. anything that's not a static string we wrote) MUST go through HTMLDefanger before being inserted into the DOM. The defang method returns a DOM node or fragment, which you can append directly.

    DO NOT get the HTML return type and set it as innerHTML. While this should be safe in theory, in practice browsers may reparse it differently so you end up with a different (potentially dangerous) DOM tree. This is called mXSS. DOMPurify tries to fix the mXSS bugs it knows about; I prefer the safer option of never doing the operation that can lead to it in the first place. The HTML return type is only for serialising into record state.

    The _INERT return type returns DOM nodes that are still in the inert document and not imported. If you use this and then want to insert it into the document after further transformations you MUST use `document.importNode(...)` to safely import it; DO NOT use document.adoptNode (or omit importing it), as this may leave shadow roots in place that can contain unsanitised content.

    This defanger will strip all comments; they're not dangerous, just not necessary. If you have a usecase where you need them preserved, talk to neilj.

    It strips rather than attempting to defang MathML or SVG. It could be extended to do so if needed.

    Code initially based off DOMPurify https://github.com/cure53/DOMPurify/
*/

const TAGS_ALLOW = {
    A: true,
    ABBR: true,
    ACRONYM: true,
    ADDRESS: true,
    AREA: true,
    ARTICLE: true,
    ASIDE: true,
    AUDIO: true,
    B: true,
    BDI: true,
    BDO: true,
    BIG: true,
    BLINK: true,
    BLOCKQUOTE: true,
    BODY: true,
    BR: true,
    BUTTON: true,
    CANVAS: true,
    CAPTION: true,
    CENTER: true,
    CITE: true,
    CODE: true,
    COL: true,
    COLGROUP: true,
    CONTENT: true,
    DATA: true,
    DATALIST: true,
    DD: true,
    DECORATOR: true,
    DEL: true,
    DETAILS: true,
    DFN: true,
    DIR: true,
    DIV: true,
    DL: true,
    DT: true,
    ELEMENT: true,
    EM: true,
    FIELDSET: true,
    FIGCAPTION: true,
    FIGURE: true,
    FONT: true,
    FOOTER: true,
    FORM: true,
    H1: true,
    H2: true,
    H3: true,
    H4: true,
    H5: true,
    H6: true,
    HEAD: true,
    HEADER: true,
    HGROUP: true,
    HR: true,
    HTML: true,
    I: true,
    IMG: true,
    INPUT: true,
    INS: true,
    KBD: true,
    LABEL: true,
    LEGEND: true,
    LI: true,
    MAIN: true,
    MAP: true,
    MARK: true,
    MARQUEE: true,
    MENU: true,
    MENUITEM: true,
    METER: true,
    NAV: true,
    NOBR: true,
    OL: true,
    OPTGROUP: true,
    OPTION: true,
    OUTPUT: true,
    P: true,
    PICTURE: true,
    PRE: true,
    PROGRESS: true,
    Q: true,
    RP: true,
    RT: true,
    RUBY: true,
    S: true,
    SAMP: true,
    SECTION: true,
    SELECT: true,
    SHADOW: true,
    SMALL: true,
    SOURCE: true,
    SPACER: true,
    SPAN: true,
    STRIKE: true,
    STRONG: true,
    STYLE: true,
    SUB: true,
    SUMMARY: true,
    SUP: true,
    TABLE: true,
    TBODY: true,
    TD: true,
    TEMPLATE: true,
    TEXTAREA: true,
    TFOOT: true,
    TH: true,
    THEAD: true,
    TIME: true,
    TR: true,
    TRACK: true,
    TT: true,
    U: true,
    UL: true,
    VAR: true,
    VIDEO: true,
    WBR: true,
};

const TAGS_FORBID_CONTENTS = {
    AUDIO: true,
    COLGROUP: true,
    HEAD: true,
    IFRAME: true,
    MATH: true,
    NOEMBED: true,
    NOFRAMES: true,
    PLAINTEXT: true,
    SCRIPT: true,
    STYLE: true,
    SVG: true,
    TEMPLATE: true,
    THEAD: true,
    TITLE: true,
    VIDEO: true,
    XMP: true,
};

const TAGS_ALLOW_DATA_URI = {
    AUDIO: true,
    VIDEO: true,
    IMG: true,
    SOURCE: true,
    IMAGE: true,
};

// ---

const ATTRS_ALLOW = {
    accept: true,
    action: true,
    align: true,
    alt: true,
    autocomplete: true,
    background: true,
    bgcolor: true,
    border: true,
    cellpadding: true,
    cellspacing: true,
    checked: true,
    cite: true,
    class: true,
    clear: true,
    color: true,
    cols: true,
    colspan: true,
    controls: true,
    coords: true,
    crossorigin: true,
    datetime: true,
    default: true,
    dir: true,
    disabled: true,
    download: true,
    enctype: true,
    face: true,
    for: true,
    headers: true,
    height: true,
    hidden: true,
    high: true,
    href: true,
    hreflang: true,
    id: true,
    integrity: true,
    ismap: true,
    label: true,
    lang: true,
    list: true,
    loop: true,
    low: true,
    max: true,
    maxlength: true,
    media: true,
    method: true,
    min: true,
    minlength: true,
    multiple: true,
    name: true,
    noshade: true,
    novalidate: true,
    nowrap: true,
    open: true,
    optimum: true,
    pattern: true,
    placeholder: true,
    poster: true,
    preload: true,
    pubdate: true,
    radiogroup: true,
    readonly: true,
    rel: true,
    required: true,
    rev: true,
    reversed: true,
    role: true,
    rows: true,
    rowspan: true,
    spellcheck: true,
    scope: true,
    selected: true,
    shape: true,
    size: true,
    sizes: true,
    span: true,
    srclang: true,
    start: true,
    src: true,
    srcset: true,
    step: true,
    style: true,
    summary: true,
    tabindex: true,
    target: true,
    title: true,
    type: true,
    usemap: true,
    valign: true,
    value: true,
    width: true,
    xmlns: true,
};

const ATTRS_INERT = {
    alt: true,
    class: true,
    for: true,
    id: true,
    label: true,
    name: true,
    pattern: true,
    placeholder: true,
    summary: true,
    title: true,
    value: true,
    style: true,
    xmlns: true,
};

// ---

const ATTR_LEADING_WHITESPACE = /^[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205f\u3000]+/g;

const ATTR_SCRIPT_OR_DATA = /^(?:\w+script|data):/i;

const formElement = document.createElement('form');

const isValidAttribute = function (nodeName, name, value, options) {
    // Check for clobbering
    if (
        (name === 'id' || name === 'name') &&
        (value in document || value in formElement)
    ) {
        return false;
    }
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
    if (!options.allowAttributes[name] || options.forbidAttributes[name]) {
        return false;
    }
    // Is the value safe?
    // Always for inert attributes
    if (ATTRS_INERT[name]) {
        return true;
    }
    value = value.replace(ATTR_LEADING_WHITESPACE, '');
    // Keep image data URIs alive if src is allowed
    if (
        TAGS_ALLOW_DATA_URI[nodeName] &&
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

const defangAttributes = function (node, options) {
    const attributes = Array.from(node.attributes);
    const nodeName = node.nodeName;
    let l = attributes.length;
    while (l--) {
        const attr = attributes[l];
        const name = attr.name.toLowerCase();
        const value = attr.value;
        if (
            isValidAttribute(nodeName, name, value, options) &&
            options.onAttribute.every((fn) =>
                fn(name, value, node, nodeName, options),
            )
        ) {
            continue;
        }
        // Safari (iOS + Mac), last tested v8.0.5, crashes if you try to
        // remove a "name" attribute from an <img> tag that has an "id"
        // attribute at the time.
        if (name === 'name' && nodeName === 'IMG' && attributes.id) {
            const id = attributes.id.value;
            node.removeAttribute('id');
            node.removeAttribute(name);
            node.setAttribute('id', id);
        } else {
            // This avoids a crash in Safari v9.0 with double-ids.
            // The trick is to first set the id to be empty and then to
            // remove the attribute
            if (name === 'id') {
                node.setAttribute(name, '');
            }
            node.removeAttribute(name);
        }
    }
};

// ---

const isClobbered = function (node) {
    if (
        !(node.attributes instanceof NamedNodeMap) ||
        typeof node.removeAttribute !== 'function' ||
        typeof node.setAttribute !== 'function' ||
        typeof node.nodeName !== 'string' ||
        typeof node.removeChild !== 'function'
    ) {
        return true;
    }

    return false;
};

// If return value is false, kill node. If true, keep node.
const defangElement = function (node, options) {
    if (node.nodeType === 8 /* Node.COMMENT_NODE */ || isClobbered(node)) {
        return false;
    }
    const nodeName = node.nodeName;
    if (!options.onElement.every((fn) => fn(node, nodeName, options))) {
        return false;
    }
    if (!options.allowTags[nodeName] || options.forbidTags[nodeName]) {
        if (
            !TAGS_FORBID_CONTENTS[nodeName] &&
            typeof node.innerHTML === 'string' &&
            typeof node.insertAdjacentHTML === 'function'
        ) {
            try {
                node.insertAdjacentHTML('AfterEnd', node.innerHTML);
            } catch (error) {}
        }
        return false;
    }
    return true;
};

// ---

const getElementsByTagName = document.getElementsByTagName;

const DOM = 1;
const FRAGMENT = 2;
const HTML = 4;
const INERT = 8;
const DOM_INERT = DOM | INERT;
const FRAGMENT_INERT = FRAGMENT | INERT;

// Chrome Mobile  will sometimes crashes with error
// "Failed to execute 'acceptNode' on 'NodeFilter':
// The provided callback is no longer runnable."
// if you pass a function instead of null.
//
// IE11 requires a function.
const acceptAll = /Trident/.test(navigator.userAgent)
    ? function () {
          return 1; // NodeFilter.FILTER_ACCEPT
      }
    : null;

class HTMLDefanger {
    constructor(mixin) {
        this.allowTags = TAGS_ALLOW;
        this.forbidTags = {};
        this.allowAttributes = ATTRS_ALLOW;
        this.forbidAttributes = {};
        this.attrAllowData = false;
        this.attrAllowAria = true;
        this.onElement = [];
        this.onAttribute = [];
        this.returnType = DOM;
        Object.assign(this, mixin);
    }

    defang(html, returnType) {
        let doc = null;
        let documentElement;
        try {
            doc = new DOMParser().parseFromString(html, 'text/html');
        } catch (error) {}
        if (
            !doc ||
            typeof doc.createNodeIterator !== 'function' ||
            // In IE11, if parsing the empty string, you get a document with no
            // children, not even an <html>.
            !(documentElement = getElementsByTagName.call(doc, 'html')[0])
        ) {
            doc = document.implementation.createHTMLDocument('');
            documentElement = doc.documentElement;
        }
        const nodeIterator = doc.createNodeIterator(
            documentElement,
            129, // NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_COMMENT
            acceptAll, // Not optional in IE11
            false, // Deprecated, but required in IE11
        );
        let baseNode = null;
        let currentNode;
        while ((currentNode = nodeIterator.nextNode())) {
            if (!defangElement(currentNode, this)) {
                if (!baseNode && currentNode.nodeName === 'BASE') {
                    baseNode = currentNode;
                } else if (typeof currentNode.remove === 'function') {
                    currentNode.remove();
                } else {
                    try {
                        currentNode.parentNode.removeChild(currentNode);
                    } catch (error) {
                        currentNode.outerHTML = '';
                    }
                }
                continue;
            }
            defangAttributes(currentNode, this);
        }
        if (baseNode) {
            baseNode.parentNode.removeChild(baseNode);
        }
        if (!doc.body) {
            documentElement.appendChild(doc.createElement('body'));
        }
        // We presume all DOM clobbering has been removed by this point, so we
        // can use the standard properties/methods without issue.
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
