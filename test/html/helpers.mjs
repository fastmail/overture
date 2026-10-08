/*
    A minimal DOM for the HTMLDefanger tests, installed before the defanger
    is loaded since it reads document and the DOM constructors at import
    time.

    It parses only the simple markup the tests use, but it models clobbering
    as browsers do. A form's associated controls with an id or name shadow
    the form's same-named properties, read-only. A control is associated
    with the form its form attribute names, else its ancestor form, else, as
    WebKit's parser does, the form still open when it was parsed, even if a
    close tag has since ended the form's element. Like a browser, the
    form remembers each name it has returned in its past names map, so the
    control stays reachable by that name after the attribute is removed,
    until it leaves the form. Each <img> with a name likewise shadows the
    document's same-named property, for as long as it has the name. As in a
    browser, the attributes of an <html> or <body> tag in the markup go on
    the root or body.
*/

/*global EventTarget */

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const FOREIGN_NS = {
    math: 'http://www.w3.org/1998/Math/MathML',
    svg: 'http://www.w3.org/2000/svg',
};

const VOID_TAGS = new Set(['BR', 'HR', 'IMG', 'INPUT', 'META', 'WBR']);

// Those the parser associates with the open form
const FORM_ASSOCIATED_TAGS = new Set([
    'BUTTON',
    'FIELDSET',
    'IMG',
    'INPUT',
    'OBJECT',
    'OUTPUT',
    'SELECT',
    'TEXTAREA',
]);

class NamedNodeMap {
    constructor(attrs) {
        this._attrs = attrs;
    }
    get length() {
        return this._attrs.length;
    }
    [Symbol.iterator]() {
        return this._attrs[Symbol.iterator]();
    }
}

class CSSStyleDeclaration {}

// Names starting with _ are the fake DOM's own internals, so are never
// shadowed, and so can be used to walk the tree as a browser would.
const descendants = (node) =>
    node._children
        .filter((child) => child._nodeType === 1)
        .flatMap((child) => [child, ...descendants(child)]);

class Node extends EventTarget {
    constructor(doc) {
        super();
        this._doc = doc;
        this._parent = null;
        this._children = [];
    }
    get nodeType() {
        return this._nodeType;
    }
    get nodeName() {
        return this._nodeName;
    }
    get ownerDocument() {
        return this._doc;
    }
    get parentNode() {
        return this._parent;
    }
    get firstChild() {
        return this._children[0] || null;
    }
    get nextSibling() {
        const parent = this._parent;
        if (!parent) {
            return null;
        }
        const siblings = parent._children;
        return siblings[siblings.indexOf(this) + 1] || null;
    }
    insertBefore(node, ref) {
        for (let ancestor = this; ancestor; ancestor = ancestor._parent) {
            if (ancestor === node) {
                throw new Error('HierarchyRequestError');
            }
        }
        if (ref && ref._parent !== this) {
            throw new Error('NotFoundError');
        }
        if (node._parent) {
            node._parent.removeChild(node);
        }
        const index = ref ? this._children.indexOf(ref) : this._children.length;
        this._children.splice(index, 0, node);
        node._parent = this;
        return node;
    }
    appendChild(node) {
        return this.insertBefore(node, null);
    }
    replaceChild(node, child) {
        this.insertBefore(node, child);
        return this.removeChild(child);
    }
    removeChild(node) {
        if (node._parent !== this) {
            throw new Error('NotFoundError');
        }
        if (this._doc) {
            this._doc._willRemove(node);
        }
        this._children.splice(this._children.indexOf(node), 1);
        node._parent = null;
        return node;
    }
    remove() {
        if (this._parent) {
            this._parent.removeChild(this);
        }
    }
    // Only lists of selectors, each a tag name, id and [attribute], all
    // optional
    querySelectorAll(selector) {
        const matchers = selector.split(',').map((part) => {
            const [, tagName, id, attribute] =
                /^\s*(\w*)(?:#([\w-]+))?(?:\[([\w-]+)\])?\s*$/.exec(part);
            return (element) =>
                (!tagName ||
                    element._nodeName.toUpperCase() ===
                        tagName.toUpperCase()) &&
                (id === undefined || getAttribute(element, 'id') === id) &&
                (attribute === undefined ||
                    getAttribute(element, attribute) !== null);
        });
        return descendants(this).filter((element) =>
            matchers.some((matches) => matches(element)),
        );
    }
    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }
    getElementsByTagName(tagName) {
        const nodeName = tagName.toUpperCase();
        return descendants(this).filter(
            (element) => nodeName === '*' || element._nodeName === nodeName,
        );
    }
}

class Text extends Node {
    constructor(doc, data) {
        super(doc);
        this._nodeType = 3;
        this._nodeName = '#text';
        this.data = data;
    }
}

class Comment extends Node {
    constructor(doc, data) {
        super(doc);
        this._nodeType = 8;
        this._nodeName = '#comment';
        this.data = data;
    }
}

class Element extends Node {
    constructor(doc, nodeName, namespaceURI = HTML_NS) {
        super(doc);
        this._nodeType = 1;
        this._namespaceURI = namespaceURI;
        this._nodeName =
            namespaceURI === HTML_NS ? nodeName.toUpperCase() : nodeName;
        this._attrs = [];
        this._style = new CSSStyleDeclaration();
    }
    get namespaceURI() {
        return this._namespaceURI;
    }
    get attributes() {
        return new NamedNodeMap(this._attrs);
    }
    get style() {
        return this._style;
    }
    // As in a browser, the by-name methods lowercase the name on an HTML
    // element, and act on the first attribute with that qualified name.
    _qualifiedName(name) {
        return this._namespaceURI === HTML_NS ? name.toLowerCase() : name;
    }
    getAttributeNames() {
        return this._attrs.map((attr) => attr.name);
    }
    getAttribute(name) {
        name = this._qualifiedName(name);
        const attr = this._attrs.find((each) => each.name === name);
        return attr ? attr.value : null;
    }
    setAttribute(name, value) {
        name = this._qualifiedName(name);
        const attr = this._attrs.find((each) => each.name === name);
        if (attr) {
            attr.value = String(value);
        } else {
            this._attrs.push({
                name,
                value: String(value),
                namespaceURI: null,
                ownerElement: this,
            });
        }
    }
    setAttributeNS(namespaceURI, name, value) {
        const attr = this._attrs.find(
            (each) => each.namespaceURI === namespaceURI && each.name === name,
        );
        if (attr) {
            attr.value = String(value);
        } else {
            this._attrs.push({
                name,
                value: String(value),
                namespaceURI,
                ownerElement: this,
            });
        }
    }
    removeAttribute(name) {
        name = this._qualifiedName(name);
        const attr = this._attrs.find((each) => each.name === name);
        if (attr) {
            this.removeAttributeNode(attr);
        }
    }
    removeAttributeNode(attr) {
        const index = this._attrs.indexOf(attr);
        if (index === -1) {
            throw new Error('NotFoundError');
        }
        this._attrs.splice(index, 1);
        attr.ownerElement = null;
        return attr;
    }
    get innerHTML() {
        return this._children.map(serialize).join('');
    }
}

const serialize = (node) => {
    if (node instanceof Text) {
        return node.data;
    }
    if (node instanceof Comment) {
        return `<!--${node.data}-->`;
    }
    const tag = node.nodeName.toLowerCase();
    const attrs = node._attrs
        .map(({ name, value }) => ` ${name}="${value}"`)
        .join('');
    return VOID_TAGS.has(node.nodeName)
        ? `<${tag}${attrs}>`
        : `<${tag}${attrs}>${node.innerHTML}</${tag}>`;
};

// Always 129 (SHOW_ELEMENT|SHOW_COMMENT), which is all the defanger uses.
// Like a real NodeIterator, it is live: removing the reference node moves
// the reference back to the node before it in document order.
class NodeIterator {
    constructor(root) {
        this._root = root;
        this._ref = null;
    }
    _following(node) {
        if (node._children.length) {
            return node._children[0];
        }
        for (; node && node !== this._root; node = node._parent) {
            if (node.nextSibling) {
                return node.nextSibling;
            }
        }
        return null;
    }
    nextNode() {
        let node = this._ref ? this._following(this._ref) : this._root;
        while (node && !(node instanceof Element || node instanceof Comment)) {
            node = this._following(node);
        }
        if (node) {
            this._ref = node;
        }
        return node;
    }
    _willRemove(node) {
        for (let ref = this._ref; ref; ref = ref._parent) {
            if (ref === node) {
                const siblings = node._parent._children;
                let prev = siblings[siblings.indexOf(node) - 1];
                if (!prev) {
                    this._ref = node._parent;
                    return;
                }
                while (prev._children.length) {
                    prev = prev._children[prev._children.length - 1];
                }
                this._ref = prev;
                return;
            }
        }
    }
}

class Document extends Node {
    constructor() {
        super(null);
        this._nodeName = '#document';
        this._iterators = [];
        this.documentElement = null;
    }
    _willRemove(node) {
        this._iterators.forEach((iterator) => iterator._willRemove(node));
    }
    get body() {
        return this.getElementsByTagName('body')[0] || null;
    }
    createElement(nodeName) {
        return createElement(this, nodeName);
    }
    createNodeIterator(root) {
        const iterator = new NodeIterator(root);
        this._iterators.push(iterator);
        return iterator;
    }
    get head() {
        return this.getElementsByTagName('head')[0] || null;
    }
    get implementation() {
        return { createHTMLDocument: () => parse('') };
    }
}

const getAttribute = (element, name) =>
    Element.prototype.getAttribute.call(element, name);

const getRoot = (node) => {
    while (node._parent) {
        node = node._parent;
    }
    return node;
};

const getFormOwner = (element) => {
    const formId = getAttribute(element, 'form');
    if (formId !== null) {
        return (
            descendants(getRoot(element)).find(
                (node) =>
                    node._nodeName === 'FORM' &&
                    getAttribute(node, 'id') === formId,
            ) || null
        );
    }
    for (let node = element._parent; node; node = node._parent) {
        if (node._nodeName === 'FORM') {
            return node;
        }
    }
    return element._parserForm || null;
};

// The listed controls each have a form getter on their own prototype.
const FORM_CONTROL_CLASSES = Object.fromEntries(
    [
        ['BUTTON', 'HTMLButtonElement'],
        ['FIELDSET', 'HTMLFieldSetElement'],
        ['INPUT', 'HTMLInputElement'],
        ['OBJECT', 'HTMLObjectElement'],
        ['OUTPUT', 'HTMLOutputElement'],
        ['SELECT', 'HTMLSelectElement'],
        ['TEXTAREA', 'HTMLTextAreaElement'],
    ].map(([nodeName, className]) => [
        nodeName,
        {
            [className]: class extends Element {
                get form() {
                    return getFormOwner(this);
                }
            },
        }[className],
    ]),
);

// Names starting with _ are the fake DOM's own internals, so are never
// shadowed.
const makeDocument = (doc) => {
    const findNamed = (name) =>
        (!name.startsWith('_') &&
            descendants(doc).find(
                (element) =>
                    element._nodeName === 'IMG' &&
                    getAttribute(element, 'name') === name,
            )) ||
        null;
    return new Proxy(doc, {
        get(target, name, receiver) {
            return (
                (typeof name === 'string' && findNamed(name)) ||
                Reflect.get(target, name, receiver)
            );
        },
        has(target, name) {
            return (
                (typeof name === 'string' && !!findNamed(name)) ||
                Reflect.has(target, name)
            );
        },
    });
};

const makeForm = (form) => {
    const pastNames = new Map();
    const isAssociated = (element) => getFormOwner(element) === proxy;
    const findNamed = (name) => {
        if (name.startsWith('_')) {
            return null;
        }
        const control = descendants(getRoot(form)).find(
            (element) =>
                element !== proxy &&
                (getAttribute(element, 'id') === name ||
                    getAttribute(element, 'name') === name) &&
                isAssociated(element),
        );
        if (control) {
            pastNames.set(name, control);
            return control;
        }
        const pastControl = pastNames.get(name);
        if (pastControl && isAssociated(pastControl)) {
            return pastControl;
        }
        pastNames.delete(name);
        return null;
    };
    const proxy = new Proxy(form, {
        get(target, name, receiver) {
            return (
                (typeof name === 'string' && findNamed(name)) ||
                Reflect.get(target, name, receiver)
            );
        },
        has(target, name) {
            return (
                (typeof name === 'string' && !!findNamed(name)) ||
                Reflect.has(target, name)
            );
        },
        set(target, name, value, receiver) {
            if (typeof name === 'string' && findNamed(name)) {
                return false;
            }
            return Reflect.set(target, name, value, receiver);
        },
    });
    return proxy;
};

// Some of the properties HTMLFormElement adds to Element, with their
// defaults. Like a browser's, they reflect the attribute of the same name.
const FORM_PROPERTIES = { action: '', method: 'get', rel: '', target: '' };

const createElement = (doc, nodeName, namespaceURI = HTML_NS) => {
    const ElementClass =
        (namespaceURI === HTML_NS &&
            FORM_CONTROL_CLASSES[nodeName.toUpperCase()]) ||
        Element;
    const element = new ElementClass(doc, nodeName, namespaceURI);
    if (element.nodeName !== 'FORM') {
        return element;
    }
    for (const [name, fallback] of Object.entries(FORM_PROPERTIES)) {
        Object.defineProperty(element, name, {
            get: () => getAttribute(element, name) ?? fallback,
            set: (value) => {
                Element.prototype.setAttribute.call(element, name, value);
            },
        });
    }
    return makeForm(element);
};

const TOKEN =
    /<!--([\s\S]*?)-->|<\/(\w+)\s*>|<(\w+)((?:\s+[^\s=>]+(?:=(?:"[^"]*"|[^\s>]*))?)*)\s*>|([^<]+)/g;
const ATTR = /([^\s=>]+)(?:=(?:"([^"]*)"|([^\s>]*)))?/g;

// Builds html > head + body, with the markup parsed into body. A close tag
// ends the nearest open element of its name, if any. Like a browser, it
// keeps a pointer to the last form opened until a </form> tag clears it.
const parse = (html) => {
    const doc = makeDocument(new Document());
    const root = doc.appendChild(doc.createElement('html'));
    root.appendChild(doc.createElement('head'));
    const body = root.appendChild(doc.createElement('body'));
    doc.documentElement = root;
    let parent = body;
    let openForm = null;
    for (const [, comment, close, open, attrs, text] of html.matchAll(TOKEN)) {
        if (comment !== undefined) {
            parent.appendChild(new Comment(doc, comment));
        } else if (close) {
            const nodeName = close.toUpperCase();
            for (let node = parent; node !== body; node = node._parent) {
                if (node._nodeName.toUpperCase() === nodeName) {
                    parent = node._parent;
                    break;
                }
            }
            if (nodeName === 'FORM') {
                openForm = null;
            }
        } else if (open && /^(?:html|body)$/i.test(open)) {
            const element = open.toLowerCase() === 'html' ? root : body;
            for (const [, name, quoted, bare] of attrs.matchAll(ATTR)) {
                if (element.getAttribute(name.toLowerCase()) === null) {
                    element.setAttribute(
                        name.toLowerCase(),
                        quoted ?? bare ?? '',
                    );
                }
            }
        } else if (open) {
            const namespaceURI =
                parent.namespaceURI === HTML_NS
                    ? FOREIGN_NS[open.toLowerCase()] || HTML_NS
                    : parent.namespaceURI;
            const element = parent.appendChild(
                createElement(doc, open.toLowerCase(), namespaceURI),
            );
            for (const [, name, quoted, bare] of attrs.matchAll(ATTR)) {
                element.setAttribute(name.toLowerCase(), quoted ?? bare ?? '');
            }
            if (element._nodeName === 'FORM') {
                openForm = element;
            } else if (
                openForm &&
                FORM_ASSOCIATED_TAGS.has(element._nodeName)
            ) {
                element._parserForm = openForm;
            }
            if (!VOID_TAGS.has(element.nodeName)) {
                parent = element;
            }
        } else {
            parent.appendChild(new Text(doc, text));
        }
    }
    return doc;
};

class DOMParser {
    parseFromString(html) {
        return parse(html);
    }
}

Object.assign(globalThis, {
    ...Object.fromEntries(
        Object.values(FORM_CONTROL_CLASSES).map((Class) => [Class.name, Class]),
    ),
    DOMParser,
    Document,
    Element,
    Node,
    document: new Document(),
});

const { HTMLDefanger, HTML, DOM_INERT } =
    await import('../../source/html/HTMLDefanger.js');

export { DOM_INERT, HTML, HTMLDefanger };
