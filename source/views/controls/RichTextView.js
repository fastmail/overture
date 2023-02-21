/*global window, document, FileReader, Squire */

import { formatKeyForPlatform } from '../../application/formatKeyForPlatform.js';
import { Class, meta } from '../../core/Core.js';
import { email as emailRegExp } from '../../core/RegExp.js';
import { isClickModified, lookupKey } from '../../dom/DOMEvent.js';
import { create as el, getStyle, nearest } from '../../dom/Element.js';
import { COPY } from '../../drag/DragEffect.js';
import { DropTarget } from '../../drag/DropTarget.js';
import { bind, bindTwoWay } from '../../foundation/Binding.js';
import { invokeInNextEventLoop } from '../../foundation/RunLoop.js';
import { isEqualToValue } from '../../foundation/Transform.js';
import { loc } from '../../localisation/i18n.js';
import { isAndroid, isApple, isIOS } from '../../ua/UA.js';
import { when } from '../collections/SwitchView.js';
import { ToolbarView } from '../collections/ToolbarView.js';
import { ScrollView } from '../containers/ScrollView.js';
import { MenuView } from '../menu/MenuView.js';
import { PopOverView } from '../panels/PopOverView.js';
import { RootView } from '../RootView.js';
import { View } from '../View.js';
import { ViewEventsController } from '../ViewEventsController.js';
import { ButtonView } from './ButtonView.js';
import { FileButtonView } from './FileButtonView.js';
import { TextInputView } from './TextInputView.js';

/* { property, nocache, on, observes, nextFrame, queue } from */
import '../../foundation/Decorators.js';

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
const urlRegExp =
    /^(?:https?:\/\/)?[\w.]+[.][a-z]{2,4}(?:\/[^\s()<>]+|\([^\s()<>]+\))*/i;

const TOOLBAR_HIDDEN = 0;
const TOOLBAR_AT_TOP = 1;
const TOOLBAR_ABOVE_KEYBOARD = 2;

const URLPickerView = Class({
    Name: 'URLPickerView',

    Extends: View,

    prompt: '',
    placeholder: '',
    confirm: '',

    value: '',

    className: 'v-UrlPicker u-p-5 u-space-y-4',

    draw(/* layer */) {
        return [
            (this._input = new TextInputView({
                inputAttributes: {
                    autocapitalize: 'off',
                    autocomplete: 'off',
                    autocorrect: 'off',
                    spellcheck: 'false',
                },
                label: this.get('prompt'),
                value: bindTwoWay(this, 'value'),
                placeholder: this.get('placeholder'),
            })),
            el('p.u-flex.u-space-x-2', [
                new ButtonView({
                    type: 'v-Button--cta v-Button--sizeM',
                    label: this.get('confirm'),
                    target: this,
                    method: 'add',
                }),
                new ButtonView({
                    type: 'v-Button--standard v-Button--sizeM',
                    label: loc('Cancel'),
                    target: this.get('popOver'),
                    method: 'hide',
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
    }.on('keypress'),
});

const RichTextView = Class({
    Name: 'RichTextView',

    Extends: View,

    Mixin: DropTarget,

    isFocused: false,
    isDisabled: false,
    tabIndex: undefined,
    label: undefined,

    isToolbarShown: false,

    checkToolbarShown() {
        this.set(
            'isToolbarShown',
            this.get('isFocused') || this.get('popOver').get('isVisible'),
        );
    },

    popOver: function () {
        return new PopOverView();
    }.property(),

    // ---

    savedSelection: null,
    isTextSelected: false,

    setIsTextSelected: function (event) {
        this.set('isTextSelected', event.type === 'select');
    }.on('cursor', 'select'),

    // ---

    showToolbar: isIOS || isAndroid ? TOOLBAR_ABOVE_KEYBOARD : TOOLBAR_AT_TOP,
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
    editorConfig: null,
    styles: null,

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
        const popOver = meta(this).cache.popOver;
        if (popOver) {
            popOver.destroy();
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
            const range = document.createRange();
            range.setStart(selection.sc, selection.so);
            range.setEnd(selection.ec, selection.eo);
            editor.setSelection(range).focus();
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
            this.get('editorConfig'),
        );
        editor
            .setHTML(this._value)
            .addEventListener('input', this)
            .addEventListener('select', this)
            .addEventListener('cursor', this)
            .addEventListener('pathChange', this)
            .addEventListener('undoStateChange', this)
            .addEventListener('pasteImage', this);
        this.set('editor', editor).set('path', editor.getPath());

        if (this.get('isDisabled')) {
            this.redrawIsDisabled();
        }

        const showToolbar = this.get('showToolbar');
        let toolbarView = null;
        if (showToolbar === TOOLBAR_AT_TOP) {
            toolbarView = this.get('toolbarView');
        } else if (showToolbar === TOOLBAR_ABOVE_KEYBOARD) {
            toolbarView = when(this, 'isToolbarShown')
                .show([this.get('toolbarView')])
                .end();
        }

        return [
            el('style', { type: 'text/css' }, [this.get('styles')]),
            toolbarView,
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
        if (!this.get('isFocused') || !this.get('isInDocument')) {
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
        const scrollViewHeight =
            scrollView.get('pxHeight') -
            scrollView.getParent(RootView).get('safeAreaInsetBottom');
        const showToolbar = this.get('showToolbar');
        const toolbarView =
            showToolbar !== TOOLBAR_HIDDEN ? this.get('toolbarView') : null;
        const toolbarHeight = toolbarView?.get('pxHeight') || 0;
        const topToolbarHeight =
            showToolbar === TOOLBAR_AT_TOP ? toolbarHeight : 0;
        const bottomToolbarHeight =
            showToolbar === TOOLBAR_ABOVE_KEYBOARD
                ? toolbarHeight +
                  (toolbarView.get('isInDocument')
                      ? parseInt(
                            getStyle(toolbarView.get('layer'), 'margin-bottom'),
                            10,
                        ) || 0
                      : 0)
                : 0;
        let scrollBy = 0;
        const minimumGapToScrollEdge = 16;
        if (offsetTop < topToolbarHeight + minimumGapToScrollEdge) {
            scrollBy = offsetTop - topToolbarHeight - minimumGapToScrollEdge;
        } else if (
            offsetBottom >
            scrollViewHeight - bottomToolbarHeight - minimumGapToScrollEdge
        ) {
            scrollBy =
                offsetBottom +
                bottomToolbarHeight +
                minimumGapToScrollEdge -
                scrollViewHeight;
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
        const rootView = this.getParent(RootView);
        const showToolbar = this.get('showToolbar');

        return new ToolbarView({
            className: 'v-Toolbar v-Toolbar--preventOverlap v-RichText-toolbar',
            overflowMenuType: '',
            positioning:
                showToolbar === TOOLBAR_ABOVE_KEYBOARD ? 'fixed' : 'sticky',
            preventOverlap: showToolbar === TOOLBAR_AT_TOP,
            ...(showToolbar === TOOLBAR_ABOVE_KEYBOARD
                ? {
                      layout: bind(
                          rootView,
                          'safeAreaInsetBottom',
                          (bottom) => ({ bottom }),
                      ),
                      mousedown: function (event) {
                          event.preventDefault();
                      }.on('mousedown'),
                  }
                : {}),
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
                    label: loc('Text size'),
                    tooltip: loc('Text size'),
                    target: this,
                    method: 'showFontSizeMenu',
                }),
                font: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('font'),
                    label: loc('Font face'),
                    tooltip: loc('Font face'),
                    target: this,
                    method: 'showFontFaceMenu',
                }),
                color: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('color'),
                    label: loc('Text color'),
                    tooltip: loc('Text color'),
                    target: this,
                    method: 'showTextColorMenu',
                }),
                bgcolor: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('bgcolor'),
                    label: loc('Text highlight'),
                    tooltip: loc('Text highlight'),
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
                    label: loc('Preformatted text'),
                    tooltip:
                        loc('Preformatted text') +
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
                    label: loc('Insert image'),
                    tooltip: loc('Insert image'),
                    acceptMultiple: true,
                    acceptOnlyTypes: 'image/jpeg, image/png, image/gif',
                    target: this,
                    method: 'insertImagesFromFiles',
                }),
                remoteImage: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('image'),
                    label: loc('Insert image'),
                    tooltip: loc('Insert image'),
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
                    label: loc('Text direction: left to right'),
                    tooltip: loc('Text direction: left to right'),
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
                    label: loc('Text direction: right to left'),
                    tooltip: loc('Text direction: right to left'),
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
                    activate() {
                        richTextView.increaseQuoteLevel();
                        this.fire('button:activate');
                    },
                }),
                unquote: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('unquote'),
                    label: loc('Unquote'),
                    tooltip:
                        loc('Unquote') + '\n' + formatKeyForPlatform('Cmd-['),
                    activate() {
                        richTextView.decreaseQuoteLevel();
                        this.fire('button:activate');
                    },
                }),
                ul: new ButtonView({
                    tabIndex: -1,
                    type: 'v-Button--iconOnly',
                    icon: this.getIcon('ul'),
                    isActive: bind(this, 'isUnorderedList'),
                    label: loc('Unordered list'),
                    tooltip:
                        loc('Unordered list') +
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
                    label: loc('Ordered list'),
                    tooltip:
                        loc('Ordered list') +
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
                    label: loc('Clear formatting'),
                    tooltip: loc('Clear formatting'),
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
        this.showOverlay(this.get('fontSizeMenuView'), buttonView);
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
        this.showOverlay(this.get('fontFaceMenuView'), buttonView);
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
        this.showOverlay(this.get('textColorMenuView'), buttonView);
    },

    showTextHighlightColorMenu(buttonView) {
        this._colorText = false;
        this.showOverlay(this.get('textColorMenuView'), buttonView);
    },

    linkOverlayView: function () {
        const richTextView = this;
        return new URLPickerView({
            prompt: loc('Add a link to the following URL or email:'),
            placeholder: 'e.g. www.example.com',
            confirm: loc('Add link'),
            popOver: richTextView.get('popOver'),
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
                    if (email && email[0].length === url.length) {
                        url =
                            'mailto:' +
                            encodeURIComponent(email[0]).replace(/%40/g, '@');
                        // Or an http:// prefix if not.
                    } else {
                        url = 'http://' + url;
                    }
                }
                richTextView.makeLink(url);
                this.get('popOver').hide();
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
            confirm: loc('Insert image'),
            popOver: richTextView.get('popOver'),
            add() {
                let url = this.get('value').trim();
                if (!/^(?:https?|data):/i.test(url)) {
                    // Must be http/https/data protocol
                    if (/^[a-z]+:/i.test(url)) {
                        return;
                    }
                    // If none, presume http
                    url = 'http://' + url;
                }
                richTextView.insertImage(url);
                this.get('popOver').hide();
            },
        });
    }.property(),

    showInsertImageOverlay(buttonView) {
        const view = this.get('insertImageOverlayView');
        view.set('value', '');
        this.showOverlay(view, buttonView);
    },

    showOverlay(view, buttonView) {
        const aboveKeyboard =
            this.get('showToolbar') === TOOLBAR_ABOVE_KEYBOARD;

        // If we're in the overflow menu, align with the "More" button.
        if (buttonView.getParent(MenuView)) {
            buttonView = this.get('toolbarView').getView('overflow');
        }
        const richTextView = this;
        this.get('popOver').show({
            view,
            positionToThe: aboveKeyboard ? 'top' : 'bottom',
            alignWithView: buttonView,
            alignEdge:
                !aboveKeyboard && view instanceof URLPickerView
                    ? 'left'
                    : 'centre',
            showCallout: true,
            offsetTop: aboveKeyboard ? 0 : 2,
            offsetLeft: aboveKeyboard ? 0 : -4,
            onHide() {
                richTextView.focus();
                invokeInNextEventLoop(
                    richTextView.checkToolbarShown,
                    richTextView,
                );
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

    setTextColor: execCommand('setTextColor'),
    setHighlightColor: execCommand('setHighlightColor'),

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
                if (this.get('isLink')) {
                    this.removeLink();
                } else {
                    this.showLinkOverlay(
                        this.get('toolbarView').getView('link'),
                    );
                }
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
        this.set('canUndo', event.detail.canUndo).set(
            'canRedo',
            event.detail.canRedo,
        );
        event.stopPropagation();
    }.on('undoStateChange'),

    path: '',

    setPath: function (event) {
        this.set('path', event.detail.path);
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
        ViewEventsController.handleEvent(event, this);
    },

    _onFocus: function () {
        this.set('isFocused', true);
        this.set('isToolbarShown', true);
    }.on('focus'),

    _onBlur: function () {
        this.set('isFocused', false);
        invokeInNextEventLoop(this.checkToolbarShown, this);
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

    // --- Page image ---

    pasteImage: function (event) {
        const dropAcceptedDataTypes = this.get('dropAcceptedDataTypes');
        const images = Array.from(event.detail.clipboardData.items)
            .filter((item) => dropAcceptedDataTypes[item.type])
            .map((item) => item.getAsFile());
        if (images.length) {
            this.insertImagesFromFiles(images);
        }
    }.on('pasteImage'),

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

export { RichTextView, TOOLBAR_HIDDEN, TOOLBAR_AT_TOP, TOOLBAR_ABOVE_KEYBOARD };
