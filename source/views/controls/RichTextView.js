/*global window, document, FileReader, Squire */

import { Class } from '../../core/Core.js';
import { email as emailRegExp } from '../../core/RegExp.js';
import /* { property, nocache, on, observes, nextFrame, queue } from */ '../../foundation/Decorators.js';
import { isEqualToValue } from '../../foundation/Transform.js';
import { bind, bindTwoWay } from '../../foundation/Binding.js';
import { didError } from '../../foundation/RunLoop.js';
import { formatKeyForPlatform } from '../../application/formatKeyForPlatform.js';
import { nearest, create as el } from '../../dom/Element.js';
import { lookupKey, isClickModified } from '../../dom/DOMEvent.js';
import { DropTarget } from '../../drag/DropTarget.js';
import { COPY } from '../../drag/DragEffect.js';
import { loc } from '../../localisation/i18n.js';
import { isIOS, isApple, isAndroid } from '../../ua/UA.js';
import { View } from '../View.js';
import { ViewEventsController } from '../ViewEventsController.js';
import { ScrollView } from '../containers/ScrollView.js';
import { ToolbarView } from '../collections/ToolbarView.js';
import { PopOverView } from '../panels/PopOverView.js';
import { ButtonView } from './ButtonView.js';
import { FileButtonView } from './FileButtonView.js';
import { MenuView } from '../menu/MenuView.js';
import { TextView } from './TextView.js';

const execCommand = function (command) {
    return function (arg) {
        const editor = this.get('editor');
        if (editor) {
            editor[command](arg);
        }
        return this;
    };
};

const queryCommandState = function (tag) {
    const regexp = new RegExp('(?:^|>)' + tag + '\\b');
    return function () {
        const path = this.get('path');
        return path === '(selection)'
            ? this.get('editor').hasFormat(tag)
            : regexp.test(path);
    }.property('path');
};

// Use a more relaxed definition of a URL than normal; anything URL-like we
// want to accept so we can prefill the link destination box.
const urlRegExp = /^(?:https?:\/\/)?[\w.]+[.][a-z]{2,4}(?:\/[^\s()<>]+|\([^\s()<>]+\))*/i;

const popOver = new PopOverView();

const TOOLBAR_HIDDEN = 0;
const TOOLBAR_AT_TOP = 1;

const URLPickerView = Class({
    Name: 'URLPickerView',

    Extends: View,

    prompt: '',
    placeholder: '',
    confirm: '',

    value: '',

    className: 'v-UrlPicker',

    draw(/* layer */) {
        return [
            el('h3.u-bold', [this.get('prompt')]),
            (this._input = new TextView({
                value: bindTwoWay(this, 'value'),
                placeholder: this.get('placeholder'),
            })),
            el('p.u-alignRight', [
                new ButtonView({
                    type: 'v-Button--standard v-Button--size13',
                    label: loc('Cancel'),
                    target: popOver,
                    method: 'hide',
                }),
                new ButtonView({
                    type: 'v-Button--constructive v-Button--size13',
                    label: this.get('confirm'),
                    target: this,
                    method: 'add',
                }),
            ]),
        ];
    },

    // ---

    autoFocus: function () {
        if (this.get('isInDocument')) {
            this._input
                .set('selection', {
                    start: 0,
                    end: this.get('value').length,
                })
                .focus();
        }
    }
        .nextFrame()
        .observes('isInDocument'),

    addOnEnter: function (event) {
        if (lookupKey(event) === 'Enter') {
            this.add();
        }
    }.on('keyup'),
});

const RichTextView = Class({
    Name: 'RichTextView',

    Extends: View,

    Mixin: DropTarget,

    isFocused: false,
    isDisabled: false,
    tabIndex: undefined,
    label: undefined,

    // ---

    savedSelection: null,
    isTextSelected: false,

    setIsTextSelected: function (event) {
        this.set('isTextSelected', event.type === 'select');
    }.on('cursor', 'select'),

    // ---

    showToolbar: isIOS || isAndroid ? TOOLBAR_HIDDEN : TOOLBAR_AT_TOP,
    fontFaceOptions: function () {
        return [
            [loc('Default'), null],
            ['Arial', 'arial, sans-serif'],
            ['Georgia', 'georgia, serif'],
            ['Helvetica', 'helvetica, arial, sans-serif'],
            ['Monospace', 'menlo, consolas, monospace'],
            ['Tahoma', 'tahoma, sans-serif'],
            ['Times New Roman', '"Times New Roman", times, serif'],
            ['Trebuchet MS', '"Trebuchet MS", sans-serif'],
            ['Verdana', 'verdana, sans-serif'],
        ];
    }.property(),

    fontSizeOptions: function () {
        return [
            [loc('Small'), '10px'],
            [loc('Medium'), null],
            [loc('Large'), '16px'],
            [loc('Huge'), '22px'],
        ];
    }.property(),

    editor: null,
    editorId: undefined,
    editorClassName: '',
    styles: null,
    blockDefaults: null,

    _value: '',
    value: function (html) {
        const editor = this.get('editor');
        if (editor) {
            if (html !== undefined) {
                editor.setHTML(html);
            } else {
                html = editor.getHTML();
            }
        } else {
            if (html !== undefined) {
                this._value = html;
            } else {
                html = this._value;
            }
        }
        return html;
    }
        .property()
        .nocache(),

    destroy() {
        const editor = this.get('editor');
        if (editor) {
            editor.destroy();
        }
        RichTextView.parent.destroy.call(this);
    },

    // --- Render ---

    willEnterDocument() {
        this.set('path', '');
        RichTextView.parent.willEnterDocument.call(this);
        this.get('layer').appendChild(this._editingLayer);
        return this;
    },

    didEnterDocument() {
        RichTextView.parent.didEnterDocument.call(this);

        const selection = this.get('savedSelection');
        const editor = this.get('editor');
        if (selection) {
            editor
                .setSelection(
                    editor.createRange(
                        selection.sc,
                        selection.so,
                        selection.ec,
                        selection.eo,
                    ),
                )
                .focus();
            this.set('savedSelection', null);
        } else {
            editor.moveCursorToStart();
        }

        return this;
    },

    willLeaveDocument() {
        // If focused, save cursor position
        if (this.get('isFocused')) {
            const selection = this.get('editor').getSelection();
            this.set('savedSelection', {
                sc: selection.startContainer,
                so: selection.startOffset,
                ec: selection.endContainer,
                eo: selection.endOffset,
            });
            this.blur();
        }

        return RichTextView.parent.willLeaveDocument.call(this);
    },

    didLeaveDocument() {
        // The nodes must be in a document or document fragment for DOM Range
        // API to work; otherwise will throw INVALID_NODE_TYPE_ERR errors.
        // This is important if the value is changed before appending.
        document.createDocumentFragment().appendChild(this._editingLayer);
        return RichTextView.parent.didLeaveDocument.call(this);
    },

    // ---

    className: function () {
        return (
            'v-RichText' +
            (this.get('isFocused') ? ' is-focused' : '') +
            (this.get('isDisabled') ? ' is-disabled' : '') +
            (this.get('showToolbar') === TOOLBAR_HIDDEN
                ? ' v-RichText--noToolbar'
                : '')
        );
    }.property('isFocused', 'isDisabled'),

    createEditor(root, options) {
        return new Squire(root, options);
    },

    draw(/* layer */) {
        const editorClassName = this.get('editorClassName');
        const editingLayer = (this._editingLayer = el('div', {
            'id': this.get('editorId'),
            'role': 'textbox',
            'aria-multiline': 'true',
            'aria-label': this.get('label'),
            'tabIndex': this.get('tabIndex'),
            'className':
                'v-RichText-input' +
                (editorClassName ? ' ' + editorClassName : ''),
        }));
        // The nodes must be in a document or document fragment for DOM Range
        // API to work; otherwise will throw INVALID_NODE_TYPE_ERR errors.
        document.createDocumentFragment().appendChild(editingLayer);
        const editor = this.createEditor(
            editingLayer,
            this.get('blockDefaults'),
        );
        editor
            .setHTML(this._value)
            .addEventListener('input', this)
            .addEventListener('select', this)
            .addEventListener('cursor', this)
            .addEventListener('pathChange', this)
            .addEventListener('undoStateChange', this)
            .addEventListener('dragover', this)
            .addEventListener('drop', this).didError = didError;
        this.set('editor', editor).set('path', editor.getPath());

        if (this.get('isDisabled')) {
            this.redrawIsDisabled();
        }

        return [
            el('style', { type: 'text/css' }, [this.get('styles')]),
            this.get('showToolbar') !== TOOLBAR_HIDDEN
                ? this.get('toolbarView')
                : null,
        ];
    },

    viewNeedsRedraw: function (self, property, oldValue) {
        this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('isDisabled', 'tabIndex'),

    redrawIsDisabled() {
        this._editingLayer.setAttribute(
            'contenteditable',
            this.get('isDisabled') ? 'false' : 'true',
        );
    },

    redrawTabIndex() {
        this._editingLayer.set('tabIndex', this.get('tabIndex'));
    },

    // ---

    scrollIntoView: function () {
        if (!this.get('isFocused')) {
            return;
        }

        const scrollView = this.getParent(ScrollView);
        if (!scrollView) {
            return;
        }

        const editor = this.get('editor');
        const cursorPosition = editor && editor.getCursorPosition();
        if (!cursorPosition) {
            return;
        }

        const scrollViewOffsetTop = scrollView
            .get('layer')
            .getBoundingClientRect().top;
        const offsetTop = cursorPosition.top - scrollViewOffsetTop;
        const offsetBottom = cursorPosition.bottom - scrollViewOffsetTop;
        let scrollViewHeight = scrollView.get('pxHeight');
        const toolbarHeight =
            this.get('showToolbar') === TOOLBAR_AT_TOP
                ? this.getFromPath('toolbarView.pxHeight')
                : 0;
        let scrollBy = 0;
        const minimumGapToScrollEdge = 15;
        if (isIOS) {
            scrollViewHeight -=
                // Keyboard height (in WKWebView, but not Safari)
                document.body.offsetHeight - window.innerHeight;
        }
        if (offsetTop < toolbarHeight + minimumGapToScrollEdge) {
            scrollBy = offsetTop - toolbarHeight - minimumGapToScrollEdge;
        } else if (offsetBottom > scrollViewHeight - minimumGapToScrollEdge) {
            scrollBy = offsetBottom + minimumGapToScrollEdge - scrollViewHeight;
        }
        if (scrollBy) {
            scrollView.scrollBy(0, Math.round(scrollBy), true);
        }
    }
        .queue('after')
        .on('cursor'),

    // ---

    getIcon() {
        return null;
    },

    toolbarConfig: {
        left: [
            'bold',
            'italic',
            'underline',
            'strikethrough',
            '-',
            'font',
            'size',
            '-',
            'color',
            'bgcolor',
            '-',
            'image',
            '-',
            'link',
            '-',
            'ul',
            'ol',
            '-',
            'quote',
            'unquote',
            '-',
            'left',
            'centre',
            'right',
            'justify',
            '-',
            'ltr',
            'rtl',
            '-',
            'unformat',
        ],
        right: [],
    },

    toolbarView: function () {
        const richTextView = this;
        const showToolbar = this.get('showToolbar');

        return new ToolbarView({
            className: 'v-Toolbar v-RichText-toolbar',
            positioning: 'sticky',
            preventOverlap: showToolbar === TOOLBAR_AT_TOP,
        })
            .registerViews({
                bold: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('bold'),
                    isActive: bind(this, 'isBold'),
                    label: loc('Bold'),
                    tooltip: loc('Bold') + '\n' + formatKeyForPlatform('Cmd-b'),
                    activate() {
                        if (richTextView.get('isBold')) {
                            richTextView.removeBold();
                        } else {
                            richTextView.bold();
                        }
                        this.fire('button:activate');
                    },
                }),
                italic: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('italic'),
                    isActive: bind(this, 'isItalic'),
                    label: loc('Italic'),
                    tooltip:
                        loc('Italic') + '\n' + formatKeyForPlatform('Cmd-i'),
                    activate() {
                        if (richTextView.get('isItalic')) {
                            richTextView.removeItalic();
                        } else {
                            richTextView.italic();
                        }
                        this.fire('button:activate');
                    },
                }),
                underline: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('underline'),
                    isActive: bind(this, 'isUnderlined'),
                    label: loc('Underline'),
                    tooltip:
                        loc('Underline') + '\n' + formatKeyForPlatform('Cmd-u'),
                    activate() {
                        if (richTextView.get('isUnderlined')) {
                            richTextView.removeUnderline();
                        } else {
                            richTextView.underline();
                        }
                        this.fire('button:activate');
                    },
                }),
                strikethrough: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('strikethrough'),
                    isActive: bind(this, 'isStriked'),
                    label: loc('Strikethrough'),
                    tooltip:
                        loc('Strikethrough') +
                        '\n' +
                        formatKeyForPlatform('Cmd-Shift-7'),
                    activate() {
                        if (richTextView.get('isStriked')) {
                            richTextView.removeStrikethrough();
                        } else {
                            richTextView.strikethrough();
                        }
                        this.fire('button:activate');
                    },
                }),
                size: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('size'),
                    label: loc('Font Size'),
                    tooltip: loc('Font Size'),
                    target: this,
                    method: 'showFontSizeMenu',
                }),
                font: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('font'),
                    label: loc('Font Face'),
                    tooltip: loc('Font Face'),
                    target: this,
                    method: 'showFontFaceMenu',
                }),
                color: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('color'),
                    label: loc('Text Color'),
                    tooltip: loc('Text Color'),
                    target: this,
                    method: 'showTextColorMenu',
                }),
                bgcolor: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('bgcolor'),
                    label: loc('Text Highlight'),
                    tooltip: loc('Text Highlight'),
                    target: this,
                    method: 'showTextHighlightColorMenu',
                }),
                link: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('link'),
                    isActive: bind(this, 'isLink'),
                    label: loc('Link'),
                    tooltip: loc('Link') + '\n' + formatKeyForPlatform('Cmd-k'),
                    activate() {
                        if (richTextView.get('isLink')) {
                            richTextView.removeLink();
                        } else {
                            richTextView.showLinkOverlay(this);
                        }
                        this.fire('button:activate');
                    },
                }),
                code: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('code'),
                    isActive: bind(this, 'isCode'),
                    label: loc('Preformatted Text'),
                    tooltip:
                        loc('Preformatted Text') +
                        '\n' +
                        formatKeyForPlatform('Cmd-d'),
                    activate() {
                        if (richTextView.get('isCode')) {
                            richTextView.removeCode();
                        } else {
                            richTextView.code();
                        }
                        this.fire('button:activate');
                    },
                }),
                image: new FileButtonView({
                    tabIndex: -1,
                    type: 'v-FileButton v-Button--iconOnly',
                    icon: this.getIcon('image'),
                    label: loc('Insert Image'),
                    tooltip: loc('Insert Image'),
                    acceptMultiple: true,
                    acceptOnlyTypes: 'image/jpeg, image/png, image/gif',
                    target: this,
                    method: 'insertImagesFromFiles',
                }),
                remoteImage: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('image'),
                    label: loc('Insert Image'),
                    tooltip: loc('Insert Image'),
                    target: this,
                    method: 'showInsertImageOverlay',
                }),
                left: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('left'),
                    isActive: bind(this, 'alignment', isEqualToValue('left')),
                    label: loc('Left'),
                    tooltip: loc('Left'),
                    activate() {
                        richTextView.setTextAlignment('left');
                        this.fire('button:activate');
                    },
                }),
                centre: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('centre'),
                    isActive: bind(this, 'alignment', isEqualToValue('center')),
                    label: loc('Center'),
                    tooltip: loc('Center'),
                    activate() {
                        richTextView.setTextAlignment('center');
                        this.fire('button:activate');
                    },
                }),
                right: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('right'),
                    isActive: bind(this, 'alignment', isEqualToValue('right')),
                    label: loc('Right'),
                    tooltip: loc('Right'),
                    activate() {
                        richTextView.setTextAlignment('right');
                        this.fire('button:activate');
                    },
                }),
                justify: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('justify'),
                    isActive: bind(
                        this,
                        'alignment',
                        isEqualToValue('justify'),
                    ),
                    label: loc('Justify'),
                    tooltip: loc('Justify'),
                    activate() {
                        richTextView.setTextAlignment('justify');
                        this.fire('button:activate');
                    },
                }),
                ltr: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('ltr'),
                    isActive: bind(this, 'direction', isEqualToValue('ltr')),
                    label: loc('Text Direction: Left to Right'),
                    tooltip: loc('Text Direction: Left to Right'),
                    activate() {
                        richTextView.setTextDirection('ltr');
                        this.fire('button:activate');
                    },
                }),
                rtl: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('rtl'),
                    isActive: bind(this, 'direction', isEqualToValue('rtl')),
                    label: loc('Text Direction: Right to Left'),
                    tooltip: loc('Text Direction: Right to Left'),
                    activate() {
                        richTextView.setTextDirection('rtl');
                        this.fire('button:activate');
                    },
                }),
                quote: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('quote'),
                    label: loc('Quote'),
                    tooltip:
                        loc('Quote') + '\n' + formatKeyForPlatform('Cmd-]'),
                    target: richTextView,
                    method: 'increaseQuoteLevel',
                }),
                unquote: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('unquote'),
                    label: loc('Unquote'),
                    tooltip:
                        loc('Unquote') + '\n' + formatKeyForPlatform('Cmd-['),
                    target: richTextView,
                    method: 'decreaseQuoteLevel',
                }),
                ul: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('ul'),
                    isActive: bind(this, 'isUnorderedList'),
                    label: loc('Unordered List'),
                    tooltip:
                        loc('Unordered List') +
                        '\n' +
                        formatKeyForPlatform('Cmd-Shift-8'),
                    activate() {
                        if (richTextView.get('isUnorderedList')) {
                            richTextView.removeList();
                        } else {
                            richTextView.makeUnorderedList();
                        }
                        this.fire('button:activate');
                    },
                }),
                ol: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('ol'),
                    isActive: bind(this, 'isOrderedList'),
                    label: loc('Ordered List'),
                    tooltip:
                        loc('Ordered List') +
                        '\n' +
                        formatKeyForPlatform('Cmd-Shift-9'),
                    activate() {
                        if (richTextView.get('isOrderedList')) {
                            richTextView.removeList();
                        } else {
                            richTextView.makeOrderedList();
                        }
                        this.fire('button:activate');
                    },
                }),
                unformat: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('unformat'),
                    label: loc('Clear Formatting'),
                    tooltip: loc('Clear Formatting'),
                    activate() {
                        richTextView.removeAllFormatting();
                        this.fire('button:activate');
                    },
                }),
            })
            .registerConfig('standard', this.get('toolbarConfig'));
    }.property(),

    fontSizeMenuView: function () {
        const richTextView = this;
        return new MenuView({
            showFilter: false,
            options: this.get('fontSizeOptions').map(
                ([label, fontSize]) =>
                    new ButtonView({
                        layout: fontSize
                            ? {
                                  fontSize,
                              }
                            : null,
                        label,
                        method: 'setFontSize',
                        setFontSize() {
                            richTextView.setFontSize(fontSize);
                        },
                    }),
            ),
        });
    }.property(),

    showFontSizeMenu(buttonView) {
        // If we're in the overflow menu, align with the "More" button.
        if (buttonView.getParent(MenuView)) {
            buttonView = this.get('toolbarView').getView('overflow');
        }
        popOver.show({
            view: this.get('fontSizeMenuView'),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2,
        });
    },

    fontFaceMenuView: function () {
        const richTextView = this;
        return new MenuView({
            showFilter: false,
            options: this.get('fontFaceOptions').map(
                ([label, fontFace]) =>
                    new ButtonView({
                        layout: fontFace
                            ? {
                                  fontFamily: fontFace,
                              }
                            : null,
                        label,
                        method: 'setFontFace',
                        setFontFace() {
                            richTextView.setFontFace(fontFace);
                        },
                    }),
            ),
        });
    }.property(),

    showFontFaceMenu(buttonView) {
        // If we're in the overflow menu, align with the "More" button.
        if (buttonView.getParent(MenuView)) {
            buttonView = this.get('toolbarView').getView('overflow');
        }
        popOver.show({
            view: this.get('fontFaceMenuView'),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2,
        });
    },

    _colorText: true,

    textColorMenuView: function () {
        const richTextView = this;
        return new MenuView({
            className: 'v-ColorMenu',
            showFilter: false,
            options: [
                '#000000',
                '#b22222',
                '#ff0000',
                '#ffa07a',
                '#fff0f5',
                '#800000',
                '#a52a2a',
                '#ff8c00',
                '#ffa500',
                '#faebd7',
                '#8b4513',
                '#daa520',
                '#ffd700',
                '#ffff00',
                '#ffffe0',
                '#2f4f4f',
                '#006400',
                '#008000',
                '#00ff00',
                '#f0fff0',
                '#008080',
                '#40e0d0',
                '#00ffff',
                '#afeeee',
                '#f0ffff',
                '#000080',
                '#0000cd',
                '#0000ff',
                '#add8e6',
                '#f0f8ff',
                '#4b0082',
                '#800080',
                '#ee82ee',
                '#dda0dd',
                '#e6e6fa',
                '#696969',
                '#808080',
                '#a9a9a9',
                '#d3d3d3',
                '#ffffff',
            ].map(
                (color) =>
                    new ButtonView({
                        layout: {
                            backgroundColor: color,
                        },
                        label: color,
                        method: 'setColor',
                        setColor() {
                            if (richTextView._colorText) {
                                richTextView.setTextColor(color);
                            } else {
                                richTextView.setHighlightColor(color);
                            }
                        },
                    }),
            ),
        });
    }.property(),

    showTextColorMenu(buttonView) {
        this._colorText = true;
        // If we're in the overflow menu, align with the "More" button.
        if (buttonView.getParent(MenuView)) {
            buttonView = this.get('toolbarView').getView('overflow');
        }
        popOver.show({
            view: this.get('textColorMenuView'),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2,
        });
    },

    showTextHighlightColorMenu(buttonView) {
        this._colorText = false;
        // If we're in the overflow menu, align with the "More" button.
        if (buttonView.getParent(MenuView)) {
            buttonView = this.get('toolbarView').getView('overflow');
        }
        popOver.show({
            view: this.get('textColorMenuView'),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2,
        });
    },

    linkOverlayView: function () {
        const richTextView = this;
        return new URLPickerView({
            prompt: loc('Add a link to the following URL or email:'),
            placeholder: 'e.g. www.example.com',
            confirm: loc('Add Link'),
            add() {
                let url = this.get('value').trim();
                let email;
                // Don't allow malicious links
                if (/^(?:javascript|data):/i.test(url)) {
                    return;
                }
                // If it appears to start with a url protocol,
                // pass it through verbatim.
                if (!/[a-z][\w-]+:/i.test(url)) {
                    // Otherwise, look for an email address,
                    // and add a mailto: handler, if found.
                    email = emailRegExp.exec(url);
                    if (email) {
                        url = 'mailto:' + email[0];
                        // Or an http:// prefix if not.
                    } else {
                        url = 'http://' + url;
                    }
                }
                richTextView.makeLink(url);
                popOver.hide();
            },
        });
    }.property(),

    showLinkOverlay(buttonView) {
        const view = this.get('linkOverlayView');
        let value = this.getSelectedText().trim();
        if (!urlRegExp.test(value) && !emailRegExp.test(value)) {
            value = '';
        }
        view.set('value', value);
        this.showOverlay(view, buttonView);
    },

    insertImageOverlayView: function () {
        const richTextView = this;
        return new URLPickerView({
            prompt: loc('Insert an image from the following URL:'),
            placeholder: 'e.g. https://example.com/path/to/image.jpg',
            confirm: loc('Insert Image'),
            add() {
                let url = this.get('value').trim();
                if (!/^https?:/i.test(url)) {
                    // Must be http/https protocol
                    if (/^[a-z]:/i.test(url)) {
                        return;
                    }
                    // If none, presume http
                    url = 'http://' + url;
                }
                richTextView.insertImage(url);
                popOver.hide();
            },
        });
    }.property(),

    showInsertImageOverlay(buttonView) {
        const view = this.get('insertImageOverlayView');
        view.set('value', '');
        this.showOverlay(view, buttonView);
    },

    showOverlay(view, buttonView) {
        // If we're in the overflow menu, align with the "More" button.
        if (buttonView.getParent(MenuView)) {
            buttonView = this.get('toolbarView').getView('overflow');
        }
        const richTextView = this;
        popOver.show({
            view,
            alignWithView: buttonView,
            showCallout: true,
            offsetTop: 2,
            offsetLeft: -4,
            onHide() {
                richTextView.focus();
            },
        });
    },

    // --- Commands ---

    focus() {
        const editor = this.get('editor');
        if (editor) {
            editor.focus();
        }
        return this;
    },

    blur() {
        const editor = this.get('editor');
        if (editor) {
            editor.blur();
        }
        return this;
    },

    undo: execCommand('undo'),
    redo: execCommand('redo'),

    bold: execCommand('bold'),
    italic: execCommand('italic'),
    underline: execCommand('underline'),
    strikethrough: execCommand('strikethrough'),

    removeBold: execCommand('removeBold'),
    removeItalic: execCommand('removeItalic'),
    removeUnderline: execCommand('removeUnderline'),
    removeStrikethrough: execCommand('removeStrikethrough'),

    makeLink: execCommand('makeLink'),
    removeLink: execCommand('removeLink'),

    setFontFace: execCommand('setFontFace'),
    setFontSize: execCommand('setFontSize'),

    setTextColor: execCommand('setTextColour'),
    setHighlightColor: execCommand('setHighlightColour'),

    setTextAlignment: execCommand('setTextAlignment'),
    setTextDirection: execCommand('setTextDirection'),

    increaseQuoteLevel: execCommand('increaseQuoteLevel'),
    decreaseQuoteLevel: execCommand('decreaseQuoteLevel'),

    makeUnorderedList: execCommand('makeUnorderedList'),
    makeOrderedList: execCommand('makeOrderedList'),
    removeList: execCommand('removeList'),

    increaseListLevel: execCommand('increaseListLevel'),
    decreaseListLevel: execCommand('decreaseListLevel'),

    code: execCommand('code'),
    removeCode: execCommand('removeCode'),

    removeAllFormatting: execCommand('removeAllFormatting'),

    insertImage: execCommand('insertImage'),
    insertImagesFromFiles(files) {
        if (window.FileReader) {
            files.forEach((file) => {
                const img = this.get('editor').insertImage();
                const reader = new FileReader();
                reader.onload = () => {
                    img.src = reader.result;
                    reader.onload = null;
                };
                reader.readAsDataURL(file);
            });
        }
    },

    getSelectedText() {
        const editor = this.get('editor');
        return editor ? editor.getSelectedText() : '';
    },

    kbShortcuts: function (event) {
        switch (lookupKey(event)) {
            case isApple ? 'Meta-k' : 'Ctrl-k':
                event.preventDefault();
                this.showLinkOverlay(this.get('toolbarView').getView('link'));
                break;
            case 'PageDown':
                if (!isApple) {
                    const scrollView = this.getParent(ScrollView);
                    if (scrollView) {
                        scrollView.scrollToView(
                            this,
                            {
                                y:
                                    32 +
                                    this.get('pxHeight') -
                                    scrollView.get('pxHeight'),
                            },
                            true,
                        );
                    }
                }
                break;
        }
    }.on('keydown'),

    // Low level commands

    _forEachBlock: execCommand('forEachBlock'),

    // --- Command state ---

    canUndo: false,
    canRedo: false,

    setUndoState: function (event) {
        this.set('canUndo', event.canUndo).set('canRedo', event.canRedo);
        event.stopPropagation();
    }.on('undoStateChange'),

    path: '',

    setPath: function (event) {
        this.set('path', event.path);
        event.stopPropagation();
    }.on('pathChange'),

    onSelect: function () {
        this.propertyDidChange('path');
    }.on('select'),

    isBold: queryCommandState('B'),
    isItalic: queryCommandState('I'),
    isUnderlined: queryCommandState('U'),
    isStriked: queryCommandState('S'),
    isLink: queryCommandState('A'),
    isCode: function () {
        const regexp = /(?:^|>)(?:PRE|CODE)\b/;
        const editor = this.get('editor');
        const path = this.get('path');
        return path === '(selection)'
            ? editor.hasFormat('PRE') || editor.hasFormat('CODE')
            : regexp.test(path);
    }.property('path'),

    alignment: function () {
        const path = this.get('path');
        const results = /\.align-(\w+)/.exec(path);
        let alignment;
        if (path === '(selection)') {
            alignment = '';
            this._forEachBlock((block) => {
                const align = block.style.textAlign || 'left';
                if (alignment && align !== alignment) {
                    alignment = '';
                    return true;
                }
                alignment = align;
                return false;
            });
        } else {
            alignment = results ? results[1] : 'left';
        }
        return alignment;
    }.property('path'),

    direction: function () {
        const path = this.get('path');
        const results = /\[dir=(\w+)\]/.exec(path);
        let dir;
        if (path === '(selection)') {
            dir = '';
            this._forEachBlock((block) => {
                const blockDir = block.dir || 'ltr';
                if (dir && blockDir !== dir) {
                    dir = '';
                    return true;
                }
                dir = blockDir;
                return false;
            });
        } else {
            dir = results ? results[1] : 'ltr';
        }
        return dir;
    }.property('path'),

    isUnorderedList: queryCommandState('UL'),
    isOrderedList: queryCommandState('OL'),

    // --- Keep state in sync with render ---

    handleEvent(event) {
        // Ignore real dragover/drop events from Squire. They wil be handled
        // by the standard event delegation system. We only observe these
        // to get the image paste fake dragover/drop events.
        const type = event.type;
        if ((type === 'dragover' || type === 'drop') && event.stopPropagation) {
            return;
        }
        ViewEventsController.handleEvent(event, this);
    },

    _onFocus: function () {
        this.set('isFocused', true);
    }.on('focus'),

    _onBlur: function () {
        this.set('isFocused', false);
    }.on('blur'),

    blurOnEsc: function (event) {
        // If key == esc, we want to blur. Not all browsers do this
        // automatically.
        if ((event.keyCode || event.which) === 27) {
            this.blur();
        }
    }.on('keydown'),

    // Chrome (and Opera) as of 2018-09-24 have a bug where if an image is
    // inside a link, clicking the image actually loads the link, even though
    // it's inside a content editable area.
    click: function (event) {
        const target = event.target;
        if (
            !isClickModified(event) &&
            target.nodeName === 'IMG' &&
            nearest(target, 'A', this.get('layer'))
        ) {
            event.preventDefault();
        }
    }.on('click'),

    // -- Drag and drop ---

    dropAcceptedDataTypes: {
        'image/gif': true,
        'image/jpeg': true,
        'image/png': true,
        'image/tiff': true,
    },

    dropEffect: COPY,

    drop(drag) {
        const types = this.get('dropAcceptedDataTypes');
        for (const type in types) {
            if (drag.hasDataType(type)) {
                this.insertImagesFromFiles(drag.getFiles(/^image\/.*/));
                break;
            }
        }
    },
});

export { RichTextView, TOOLBAR_HIDDEN, TOOLBAR_AT_TOP };
