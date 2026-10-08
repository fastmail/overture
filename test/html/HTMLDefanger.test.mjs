import { DOM_INERT, HTML, HTMLDefanger } from './helpers.mjs';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const defang = (html, mixin) => new HTMLDefanger(mixin).defang(html, HTML);

describe('HTMLDefanger', () => {
    test('strips comments and disallowed attributes', () => {
        assert.equal(
            defang('<p class="a" onclick="x()">hi <b>there</b></p><!--c-->'),
            '<p class="a">hi <b>there</b></p>',
        );
    });

    test('removes attributes from a form whose child shadows removeAttributeNode', () => {
        assert.equal(
            defang(
                '<p>BEFORE</p><form a=1><input name="removeAttributeNode">' +
                    '</form><p>AFTER</p>',
            ),
            '<p>BEFORE</p><form><input></form><p>AFTER</p>',
        );
    });

    test('a child img id clobbers the form too', () => {
        assert.equal(
            defang(
                '<p>BEFORE</p><form a=1><img id="removeAttributeNode">' +
                    '</form><p>AFTER</p>',
            ),
            '<p>BEFORE</p><form><img></form><p>AFTER</p>',
        );
    });

    test('strips ids from controls the parser ties to a form outside it', () => {
        assert.equal(
            defang(
                '<div><form a=1 onmouseover=x()></div><input id=attributes>',
            ),
            '<div><form></form></div><input>',
        );
        assert.equal(
            defang('<div><form a=1></div><img id=removeAttributeNode>'),
            '<div><form></form></div><img>',
        );
        assert.equal(
            defang(
                '<div><form></div><input id=getAttribute>' +
                    '<input id=nodeName><input id=remove>',
            ),
            '<div><form></form></div><input><input><input>',
        );
    });

    test('keeps a form once names shadowing its methods are stripped', () => {
        assert.equal(
            defang(
                '<p>BEFORE</p><form><input name=nodeName><input name=remove>' +
                    '<input name=parentNode></form><p>AFTER</p>',
            ),
            '<p>BEFORE</p><form><input><input><input></form><p>AFTER</p>',
        );
    });

    test('strips clobbering names before any callback runs', () => {
        const seen = [];
        const record = (node, nodeName) => {
            if (nodeName === 'HTML') {
                seen.push(typeof node.ownerDocument.querySelector);
            } else if (nodeName === 'FORM') {
                seen.push(typeof node.removeAttributeNode);
            }
            return true;
        };
        defang(
            '<img name=querySelector><form><input name=removeAttributeNode>' +
                '</form>',
            { onElement: [record] },
        );
        assert.deepEqual(seen, ['function', 'function']);
    });

    test('lets callbacks rewrite a clobbering id into a safe one', () => {
        const prefix = (name, value, node) => {
            if (name === 'id') {
                node.setAttribute(name, 'x-' + value);
            }
            return true;
        };
        assert.equal(
            defang('<p id=body>a</p><input id=body>', {
                onAttribute: [prefix],
            }),
            '<p id="x-body">a</p><input id="x-body">',
        );
        assert.equal(
            defang('<p id=body>a</p><input id=body>'),
            '<p>a</p><input>',
        );
    });

    test('leaves ids on for root callbacks, taking them off for a form', () => {
        const seen = {};
        const record = (node, nodeName) => {
            const doc = node.ownerDocument;
            if (nodeName === 'HTML') {
                seen.root = ['#body', '#action', '#method'].map(
                    (selector) => doc.querySelector(selector)?.nodeName,
                );
            } else if (nodeName === 'FORM') {
                seen.form = [doc.querySelector('#method'), node.method];
            }
            return true;
        };
        defang(
            '<p id=body>a</p><input id=action><form><input id=method></form>',
            { onElement: [record] },
        );
        assert.deepEqual(seen, {
            root: ['P', 'INPUT', 'INPUT'],
            form: [null, 'get'],
        });
    });

    test('gives a control its id back for its own callbacks', () => {
        const seen = [];
        const record = (node, nodeName) => {
            if (nodeName === 'INPUT') {
                seen.push(node.getAttribute('id'));
            }
            return true;
        };
        assert.equal(
            defang('<form><input id=method><input id=target></form>', {
                onElement: [record],
            }),
            '<form><input><input></form>',
        );
        assert.deepEqual(seen, ['method', 'target']);
    });

    test('strips a name a callback gives a form or img', () => {
        const addName = (name, value, node) => {
            node.setAttribute('name', 'foo');
            return true;
        };
        assert.equal(
            defang('<img alt=a><form action=b></form>', {
                onAttribute: [addName],
            }),
            '<img alt="a"><form action="b"></form>',
        );
    });

    test('unwraps a forbidden form whose child shadows firstChild', () => {
        assert.equal(
            defang(
                '<p>BEFORE</p><form id=x><input name=firstChild form=x>' +
                    '<b>in</b></form><p>AFTER</p>',
                { forbidTags: { FORM: true } },
            ),
            '<p>BEFORE</p><input><b>in</b><p>AFTER</p>',
        );
    });

    test('strips ids that shadow properties the document inherits', () => {
        assert.equal(
            defang(
                '<p id=addEventListener>a</p><p id=toString>b</p>' +
                    '<p id=top>c</p><p id=foo>d</p>',
            ),
            '<p>a</p><p>b</p><p id="top">c</p><p id="foo">d</p>',
        );
    });

    test('defangs a document whose createNodeIterator is shadowed', () => {
        assert.equal(
            defang('<p>a</p><img name=createNodeIterator>'),
            '<p>a</p><img>',
        );
    });

    test('checks ids and names after onAttribute rewrites them', () => {
        const unprefix = (name, value, node) => {
            if (name === 'id' || name === 'name') {
                node.setAttribute(name, value.replace(/^x-/, ''));
            }
            return true;
        };
        assert.equal(
            defang(
                '<p id=x-querySelectorAll>a</p><input name=x-removeChild>' +
                    '<p id=x-addEventListener>b</p><p id=x-foo>c</p>',
                { onAttribute: [unprefix] },
            ),
            '<p>a</p><input><p>b</p><p id="foo">c</p>',
        );
    });

    test('removes a <base>', () => {
        assert.equal(
            defang('<p>a</p><base href="https://example.com/"><p>b</p>'),
            '<p>a</p><p>b</p>',
        );
    });

    test('leaves no name a form remembers shadowing it in the output', () => {
        const root = new HTMLDefanger().defang(
            '<form><input name=nodeType></form>',
            DOM_INERT,
        );
        const form = root.getElementsByTagName('form')[0];
        assert.equal(form.nodeType, 1);
    });
});
