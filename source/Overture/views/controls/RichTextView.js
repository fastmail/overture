/*global window, document, FileReader, Squire */

import { Class } from '../../core/Core';
import '../../foundation/ComputedProps';  // For Function#property, #nocache
import '../../foundation/EventTarget';  // For Function#on
import '../../foundation/ObservableProps';  // For Function#observes
import Transform from '../../foundation/Transform';
import { bind, bindTwoWay } from '../../foundation/Binding';
import RunLoop from '../../foundation/RunLoop';  // Also Function#nextFrame
                                                    // and Function#queue
import formatKeyForPlatform from '../../application/formatKeyForPlatform';
import Element from '../../dom/Element';
import { lookupKey } from '../../dom/DOMEvent';
import DropTarget from '../../drag-drop/DropTarget';
import * as DragEffect from '../../drag-drop/DragEffect';
import { loc } from '../../localisation/LocaleController';
import UA from '../../ua/UA';
import View from '../View';
import ViewEventsController from '../ViewEventsController';
import ScrollView from '../containers/ScrollView';
import ToolbarView from '../collections/ToolbarView';
import PopOverView from '../panels/PopOverView';
import ButtonView from './ButtonView';
import FileButtonView from './FileButtonView';
import MenuView from './MenuView';
import TextView from './TextView';

const execCommand = function ( command ) {
    return function ( arg ) {
        const editor = this.get( 'editor' );
        if ( editor ) {
            editor[ command ]( arg );
        }
        return this;
    };
};

const queryCommandState = function ( tag ) {
    const regexp = new RegExp( '(?:^|>)' + tag + '\\b' );
    return function () {
        const path = this.get( 'path' );
        return path === '(selection)' ?
            this.get( 'editor' ).hasFormat( tag ) :
            regexp.test( path );
    }.property( 'path' );
};

const emailRegExp = RegExp.email;
// Use a more relaxed definition of a URL than normal; anything URL-like we
// want to accept so we can prefill the link destination box.
const urlRegExp =
    /^(?:https?:\/\/)?[\w.]+[.][a-z]{2,4}(?:\/[^\s()<>]+|\([^\s()<>]+\))*/i;

const popOver = new PopOverView();

const equalTo = Transform.isEqualToValue;

const TOOLBAR_HIDDEN = 0;
const TOOLBAR_AT_SELECTION = 1;
const TOOLBAR_AT_TOP = 2;

const hiddenFloatingToolbarLayout = {
    top: 0,
    left: 0,
    maxWidth: '100%',
    transform: 'translate3d(-100vw,0,0)',
};

const RichTextView = Class({

    Extends: View,

    Mixin: DropTarget,

    isFocussed: false,
    isDisabled: false,
    tabIndex: undefined,
    label: undefined,

    allowTextSelection: true,

    // ---

    isTextSelected: false,

    setIsTextSelected: function ( event ) {
        this.set( 'isTextSelected', event.type === 'select' );
    }.on( 'cursor', 'select' ),

    // ---

    showToolbar: UA.isIOS ? TOOLBAR_AT_SELECTION : TOOLBAR_AT_TOP,
    fontFaceOptions: [
        [ loc( 'Default' ), null ],
        [ 'Arial', 'arial, sans-serif' ],
        [ 'Georgia', 'georgia, serif' ],
        [ 'Helvetica', 'helvetica, arial, sans-serif' ],
        [ 'Monospace', 'menlo, consolas, monospace' ],
        [ 'Tahoma', 'tahoma, sans-serif' ],
        [ 'Times New Roman', '"Times New Roman", times, serif' ],
        [ 'Trebuchet MS', '"Trebuchet MS", sans-serif' ],
        [ 'Verdana', 'verdana, sans-serif' ],
    ],
    fontSizeOptions: function () {
        return [
            [ loc( 'Small' ), '10px' ],
            [ loc( 'Medium' ), null  ],
            [ loc( 'Large' ), '16px' ],
            [ loc( 'Huge' ),  '22px' ],
        ];
    }.property(),

    editor: null,
    editorClassName: '',
    styles: null,
    blockDefaults: null,

    _value: '',
    value: function ( html ) {
        const editor = this.get( 'editor' );
        if ( editor ) {
            if ( html !== undefined ) {
                editor.setHTML( html );
            } else {
                html = editor.getHTML();
            }
        } else {
            if ( html !== undefined ) {
                this._value = html;
            } else {
                html = this._value;
            }
        }
        return html;
    }.property().nocache(),

    destroy () {
        const editor = this.get( 'editor' );
        if ( editor ) {
            editor.destroy();
        }
        RichTextView.parent.destroy.call( this );
    },

    // --- Render ---

    willEnterDocument () {
        this.set( 'path', '' );
        RichTextView.parent.willEnterDocument.call( this );
        this.get( 'layer' ).appendChild( this._editingLayer );
        return this;
    },

    didEnterDocument () {
        const scrollView = this.getParent( ScrollView );
        if ( scrollView ) {
            if ( this.get( 'showToolbar' ) === TOOLBAR_AT_TOP ) {
                scrollView.addObserverForKey(
                    'scrollTop', this, '_calcToolbarPosition' );
            }
            if ( UA.isIOS ) {
                scrollView.addObserverForKey(
                    'scrollTop', this, 'redrawIOSCursor' );
            }
        }
        return RichTextView.parent.didEnterDocument.call( this );
    },

    willLeaveDocument () {
        const scrollView = this.getParent( ScrollView );
        if ( scrollView ) {
            if ( this.get( 'showToolbar' ) === TOOLBAR_AT_TOP ) {
                scrollView.removeObserverForKey(
                    'scrollTop', this, '_calcToolbarPosition' );
                this._setToolbarPosition(
                    scrollView, this.get( 'toolbarView' ), false );
            }
            if ( UA.isIOS ) {
                scrollView.removeObserverForKey(
                    'scrollTop', this, 'redrawIOSCursor' );
            }
        }
        return RichTextView.parent.willLeaveDocument.call( this );
    },

    didLeaveDocument () {
        // The nodes must be in a document or document fragment for DOM Range
        // API to work; otherwise will throw INVALID_NODE_TYPE_ERR errors.
        // This is important if the value is changed before appending.
        document.createDocumentFragment().appendChild( this._editingLayer );
        return RichTextView.parent.didLeaveDocument.call( this );
    },

    // ---

    className: function () {
        return 'v-RichText' +
            ( this.get( 'isFocussed' ) ? ' is-focussed' : '' ) +
            ( this.get( 'isDisabled' ) ? ' is-disabled' : '' ) +
            ( this.get( 'showToolbar' ) === TOOLBAR_HIDDEN ?
                ' v-RichText--noToolbar' : '' );
    }.property( 'isFocussed', 'isDisabled' ),

    draw ( layer, Element, el ) {
        const editorClassName = this.get( 'editorClassName' );
        const editingLayer = this._editingLayer = el( 'div', {
            'role': 'textbox',
            'aria-multiline': 'true',
            'aria-label': this.get( 'label' ),
            tabIndex: this.get( 'tabIndex' ),
            className: 'v-RichText-input' +
                ( editorClassName ? ' ' + editorClassName : '' ),
        });
        // The nodes must be in a document or document fragment for DOM Range
        // API to work; otherwise will throw INVALID_NODE_TYPE_ERR errors.
        document.createDocumentFragment().appendChild( editingLayer );
        const editor = new Squire( editingLayer, this.get( 'blockDefaults' ) );
        editor
            .setHTML( this._value )
            .addEventListener( 'input', this )
            .addEventListener( 'select', this )
            .addEventListener( 'cursor', this )
            .addEventListener( 'pathChange', this )
            .addEventListener( 'undoStateChange', this )
            .addEventListener( 'dragover', this )
            .addEventListener( 'drop', this )
            .didError = RunLoop.didError;
        this.set( 'editor', editor )
            .set( 'path', editor.getPath() );

        if ( this.get( 'isDisabled' ) ) {
            this.redrawIsDisabled();
        }

        return [
            el( 'style', { type: 'text/css' }, [
                this.get( 'styles' ),
            ]),
            this.get( 'showToolbar' ) !== TOOLBAR_HIDDEN ?
                this.get( 'toolbarView' ) :
                null,
        ];
    },

    viewNeedsRedraw: function ( self, property, oldValue ) {
        this.propertyNeedsRedraw( self, property, oldValue );
    }.observes( 'isDisabled', 'tabIndex' ),

    redrawIsDisabled () {
        this._editingLayer.setAttribute( 'contenteditable',
            this.get( 'isDisabled' )  ? 'false' : 'true'
        );
    },

    redrawTabIndex () {
        this._editingLayer.set( 'tabIndex', this.get( 'tabIndex' ) );
    },

    // ---

    redrawIOSCursor: function () {
        if ( this.get( 'isFocussed' ) ) {
            const editor = this.get( 'editor' );
            editor.setSelection( editor.getSelection() );
        }
    }.nextFrame(),

    scrollIntoView: function () {
        if ( !this.get( 'isFocussed' ) ) {
            return;
        }

        const scrollView = this.getParent( ScrollView );
        if ( !scrollView ) {
            return;
        }

        const editor = this.get( 'editor' );
        const cursorPosition = editor && editor.getCursorPosition();
        if ( !cursorPosition ) {
            return;
        }

        const scrollViewOffsetTop =
            scrollView.get( 'layer' ).getBoundingClientRect().top;
        const offsetTop = cursorPosition.top - scrollViewOffsetTop;
        const offsetBottom = cursorPosition.bottom - scrollViewOffsetTop;
        let scrollViewHeight = scrollView.get( 'pxHeight' );
        let scrollBy = 0;
        if ( UA.isIOS ) {
            scrollViewHeight -=
                // Keyboard height (in WKWebView, but not Safari)
                ( document.body.offsetHeight - window.innerHeight );
        }
        if ( offsetTop - 15 < 0 ) {
            scrollBy = offsetTop - 15;
        } else if ( offsetBottom + 15 > scrollViewHeight ) {
            scrollBy = offsetBottom + 15 - scrollViewHeight;
        }
        if ( scrollBy ) {
            scrollView.scrollBy( 0, Math.round( scrollBy ), true );
        }
    }.queue( 'after' ).on( 'cursor' ),

    _calcToolbarPosition ( scrollView, _, __, scrollTop ) {
        const toolbarView = this.get( 'toolbarView' );
        let offsetHeight = this._offsetHeight;
        let offsetTop = this._offsetTop;
        const now = Date.now();
        const wasSticky = toolbarView.get( 'parentView' ) !== this;

        // For performance, cache the size and position for 1/2 second from last
        // use.
        if ( !offsetTop || this._offsetExpiry < now ) {
            this._offsetHeight = offsetHeight =
                this.get( 'layer' ).offsetHeight;
            this._offsetTop = offsetTop =
                Math.floor( this.getPositionRelativeTo( scrollView ).top );
        }
        this._offsetExpiry = now + 500;

        const isSticky =
            scrollTop > offsetTop &&
            scrollTop < offsetTop + offsetHeight -
                ( scrollView.get( 'pxHeight' ) >> 2 );

        if ( isSticky !== wasSticky ) {
            this._setToolbarPosition( scrollView, toolbarView, isSticky );
        }
    },
    _setToolbarPosition ( scrollView, toolbarView, isSticky ) {
        if ( isSticky ) {
            const newParent = scrollView.get( 'parentView' );
            const position = toolbarView.getPositionRelativeTo( newParent );
            // Need to account separately for any border in the new parent.
            const borders = scrollView.getPositionRelativeTo( newParent );
            toolbarView
                .set( 'layout', {
                    top: scrollView.get( 'pxTop' ),
                    left: position.left - borders.left,
                    width: toolbarView.get( 'pxWidth' ),
                });
            newParent.insertView( toolbarView );
        } else {
            toolbarView
                .set( 'layout', {
                    top: 0,
                    left: 0,
                    right: 0,
                });
            this.insertView( toolbarView, null, 'top' );
        }
    },

    // ---

    floatingToolbarLayout: hiddenFloatingToolbarLayout,

    hideFloatingToolbar: function () {
        this.set( 'floatingToolbarLayout', hiddenFloatingToolbarLayout );
    }.on( 'cursor' ),

    showFloatingToolbar () {
        if ( this.get( 'showToolbar' ) !== TOOLBAR_AT_SELECTION ) {
            return;
        }
        const range = this.get( 'editor' ).getSelection();
        let node = UA.isIOS ? range.endContainer : range.startContainer;
        if ( node.nodeType !== 1 /* Node.ELEMENT_NODE */ ) {
            node = node.parentNode;
        }
        const position = Element.getPosition( node, this.get( 'layer' ) );
        this.set( 'floatingToolbarLayout', {
            top: 0,
            left: 0,
            maxWidth: '100%',
            transform: 'translate3d(0,' + (
                UA.isIOS ?
                position.top + position.height + 10 :
                position.top -
                    this.get( 'toolbarView' ).get( 'pxHeight' ) - 10
            ) + 'px,0)',
        });
    },

    showFloatingToolbarIfSelection: function () {
        const toolbarIsVisible =
                this.get( 'floatingToolbarLayout' ) !==
                    hiddenFloatingToolbarLayout;
        if ( !toolbarIsVisible && this.get( 'isTextSelected' ) ) {
            this.showFloatingToolbar();
        }
    }.on( 'mouseup' ),

    // ---

    toolbarConfig: {
        left: [
            'bold', 'italic', 'underline', 'strikethrough', '-',
            'font', 'size', '-',
            'color', 'bgcolor', '-',
            'image', '-',
            'link', '-',
            'ul', 'ol', '-',
            'quote', 'unquote', '-',
            'left', 'centre', 'right', 'justify', '-',
            'ltr', 'rtl', '-',
            'unformat',
        ],
        right: [],
    },

    toolbarView: function () {
        const richTextView = this;
        const showToolbar = this.get( 'showToolbar' );

        return new ToolbarView({
            className: 'v-Toolbar v-RichText-toolbar',
            positioning: 'absolute',
            layout: showToolbar === TOOLBAR_AT_TOP ? {
                overflow: 'hidden',
                zIndex: 1,
                top: 0,
                left: 0,
                right: 0,
            } : bind( this, 'floatingToolbarLayout' ),
            preventOverlap: showToolbar === TOOLBAR_AT_TOP,
        }).registerViews({
            bold: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-bold',
                isActive: bind( 'isBold', this ),
                label: loc( 'Bold' ),
                tooltip: loc( 'Bold' ) + '\n' +
                    formatKeyForPlatform( 'cmd-b' ),
                activate () {
                    if ( richTextView.get( 'isBold' ) ) {
                        richTextView.removeBold();
                    } else {
                        richTextView.bold();
                    }
                    this.fire( 'button:activate' );
                },
            }),
            italic: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-italic',
                isActive: bind( 'isItalic', this ),
                label: loc( 'Italic' ),
                tooltip: loc( 'Italic' ) + '\n' +
                    formatKeyForPlatform( 'cmd-i' ),
                activate () {
                    if ( richTextView.get( 'isItalic' ) ) {
                        richTextView.removeItalic();
                    } else {
                        richTextView.italic();
                    }
                    this.fire( 'button:activate' );
                },
            }),
            underline: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-underline',
                isActive: bind( 'isUnderlined', this ),
                label: loc( 'Underline' ),
                tooltip: loc( 'Underline' ) + '\n' +
                    formatKeyForPlatform( 'cmd-u' ),
                activate () {
                    if ( richTextView.get( 'isUnderlined' ) ) {
                        richTextView.removeUnderline();
                    } else {
                        richTextView.underline();
                    }
                    this.fire( 'button:activate' );
                },
            }),
            strikethrough: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-strikethrough',
                isActive: bind( 'isStriked', this ),
                label: loc( 'Strikethrough' ),
                tooltip: loc( 'Strikethrough' ) + '\n' +
                    formatKeyForPlatform( 'cmd-shift-7' ),
                activate () {
                    if ( richTextView.get( 'isStriked' ) ) {
                        richTextView.removeStrikethrough();
                    } else {
                        richTextView.strikethrough();
                    }
                    this.fire( 'button:activate' );
                },
            }),
            size: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-font-size',
                label: loc( 'Font Size' ),
                tooltip: loc( 'Font Size' ),
                target: this,
                method: 'showFontSizeMenu',
            }),
            font: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-font',
                label: loc( 'Font Face' ),
                tooltip: loc( 'Font Face' ),
                target: this,
                method: 'showFontFaceMenu',
            }),
            color: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-palette',
                label: loc( 'Text Color' ),
                tooltip: loc( 'Text Color' ),
                target: this,
                method: 'showTextColorMenu',
            }),
            bgcolor: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-highlight',
                label: loc( 'Text Highlight' ),
                tooltip: loc( 'Text Highlight' ),
                target: this,
                method: 'showTextHighlightColorMenu',
            }),
            link: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-link',
                isActive: bind( 'isLink', this ),
                label: loc( 'Link' ),
                tooltip: loc( 'Link' ) + '\n' +
                    formatKeyForPlatform( 'cmd-k' ),
                activate () {
                    if ( richTextView.get( 'isLink' ) ) {
                        richTextView.removeLink();
                    } else {
                        richTextView.showLinkOverlay( this );
                    }
                    this.fire( 'button:activate' );
                },
            }),
            image: new FileButtonView({
                tabIndex: -1,
                type: 'v-FileButton v-Button--iconOnly',
                icon: 'icon-image',
                label: loc( 'Insert Image' ),
                tooltip: loc( 'Insert Image' ),
                acceptMultiple: true,
                acceptOnlyTypes: 'image/jpeg, image/png, image/gif',
                target: this,
                method: 'insertImagesFromFiles',
            }),
            left: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-paragraph-left',
                isActive: bind( 'alignment', this, equalTo( 'left' ) ),
                label: loc( 'Left' ),
                tooltip: loc( 'Left' ),
                activate () {
                    richTextView.setTextAlignment( 'left' );
                    this.fire( 'button:activate' );
                },
            }),
            centre: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-paragraph-centre',
                isActive: bind( 'alignment', this, equalTo( 'center' ) ),
                label: loc( 'Center' ),
                tooltip: loc( 'Center' ),
                activate () {
                    richTextView.setTextAlignment( 'center' );
                    this.fire( 'button:activate' );
                },
            }),
            right: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-paragraph-right',
                isActive: bind( 'alignment', this, equalTo( 'right' ) ),
                label: loc( 'Right' ),
                tooltip: loc( 'Right' ),
                activate () {
                    richTextView.setTextAlignment( 'right' );
                    this.fire( 'button:activate' );
                },
            }),
            justify: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-paragraph-justify',
                isActive: bind( 'alignment', this, equalTo( 'justify' ) ),
                label: loc( 'Justify' ),
                tooltip: loc( 'Justify' ),
                activate () {
                    richTextView.setTextAlignment( 'justify' );
                    this.fire( 'button:activate' );
                },
            }),
            ltr: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-lefttoright',
                isActive: bind( 'direction', this, equalTo( 'ltr' ) ),
                label: loc( 'Text Direction: Left to Right' ),
                tooltip: loc( 'Text Direction: Left to Right' ),
                activate () {
                    richTextView.setTextDirection( 'ltr' );
                    this.fire( 'button:activate' );
                },
            }),
            rtl: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-righttoleft',
                isActive: bind( 'direction', this, equalTo( 'rtl' ) ),
                label: loc( 'Text Direction: Right to Left' ),
                tooltip: loc( 'Text Direction: Right to Left' ),
                activate () {
                    richTextView.setTextDirection( 'rtl' );
                    this.fire( 'button:activate' );
                },
            }),
            quote: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-quotes-left',
                label: loc( 'Quote' ),
                tooltip: loc( 'Quote' ) + '\n' +
                    formatKeyForPlatform( 'cmd-]' ),
                target: richTextView,
                method: 'increaseQuoteLevel',
            }),
            unquote: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-quotes-right',
                label: loc( 'Unquote' ),
                tooltip: loc( 'Unquote' ) + '\n' +
                    formatKeyForPlatform( 'cmd-[' ),
                target: richTextView,
                method: 'decreaseQuoteLevel',
            }),
            ul: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-list',
                isActive: bind( 'isUnorderedList', this ),
                label: loc( 'Unordered List' ),
                tooltip: loc( 'Unordered List' ) + '\n' +
                    formatKeyForPlatform( 'cmd-shift-8' ),
                activate () {
                    if ( richTextView.get( 'isUnorderedList' ) ) {
                        richTextView.removeList();
                    } else {
                        richTextView.makeUnorderedList();
                    }
                    this.fire( 'button:activate' );
                },
            }),
            ol: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-numbered-list',
                isActive: bind( 'isOrderedList', this ),
                label: loc( 'Ordered List' ),
                tooltip: loc( 'Ordered List' ) + '\n' +
                    formatKeyForPlatform( 'cmd-shift-9' ),
                activate () {
                    if ( richTextView.get( 'isOrderedList' ) ) {
                        richTextView.removeList();
                    } else {
                        richTextView.makeOrderedList();
                    }
                    this.fire( 'button:activate' );
                },
            }),
            unformat: new ButtonView({
                tabIndex: -1,
                type: 'v-Button--iconOnly',
                icon: 'icon-clear-formatting',
                label: loc( 'Clear Formatting' ),
                tooltip: loc( 'Clear Formatting' ),
                activate () {
                    richTextView.removeAllFormatting();
                    this.fire( 'button:activate' );
                },
            }),
        }).registerConfig( 'standard', this.get( 'toolbarConfig' ) );
    }.property(),

    fontSizeMenuView: function () {
        const richTextView = this;
        return new MenuView({
            showFilter: false,
            options: this.get( 'fontSizeOptions' ).map(
                ([ label, fontSize ]) => new ButtonView({
                    layout: fontSize ? {
                        fontSize,
                    } : null,
                    label,
                    method: 'setFontSize',
                    setFontSize () {
                        richTextView.setFontSize( fontSize );
                    },
                })
            ),
        });
    }.property(),

    showFontSizeMenu ( buttonView ) {
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view: this.get( 'fontSizeMenuView' ),
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
            options: this.get( 'fontFaceOptions' ).map(
                ([ label, fontFace ]) => new ButtonView({
                    layout: fontFace ? {
                        fontFamily: fontFace,
                    } : null,
                    label,
                    method: 'setFontFace',
                    setFontFace () {
                        richTextView.setFontFace( fontFace );
                    },
                })
            ),
        });
    }.property(),

    showFontFaceMenu ( buttonView ) {
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view: this.get( 'fontFaceMenuView' ),
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
                    '#000000', '#b22222', '#ff0000', '#ffa07a', '#fff0f5',
                    '#800000', '#a52a2a', '#ff8c00', '#ffa500', '#faebd7',
                    '#8b4513', '#daa520', '#ffd700', '#ffff00', '#ffffe0',
                    '#2f4f4f', '#006400', '#008000', '#00ff00', '#f0fff0',
                    '#008080', '#40e0d0', '#00ffff', '#afeeee', '#f0ffff',
                    '#000080', '#0000cd', '#0000ff', '#add8e6', '#f0f8ff',
                    '#4b0082', '#800080', '#ee82ee', '#dda0dd', '#e6e6fa',
                    '#696969', '#808080', '#a9a9a9', '#d3d3d3', '#ffffff',
                ].map( color => new ButtonView({
                    layout: {
                        backgroundColor: color,
                    },
                    label: color,
                    method: 'setColor',
                    setColor () {
                        if ( richTextView._colorText ) {
                            richTextView.setTextColor( color );
                        } else {
                            richTextView.setHighlightColor( color );
                        }
                    },
                })),
        });
    }.property(),

    showTextColorMenu ( buttonView ) {
        this._colorText = true;
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view: this.get( 'textColorMenuView' ),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2,
        });
    },

    showTextHighlightColorMenu ( buttonView ) {
        this._colorText = false;
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view: this.get( 'textColorMenuView' ),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2,
        });
    },

    linkOverlayView: function () {
        const richTextView = this;
        return new View({
            className: 'v-UrlPicker',
            value: '',
            draw ( layer, Element, el ) {
                return [
                    el( 'h3.u-bold', [
                        loc( 'Add a link to the following URL or email:' ),
                    ]),
                    this._input = new TextView({
                        value: bindTwoWay( 'value', this ),
                        placeholder: 'e.g. www.example.com',
                    }),
                    el( 'p.u-alignRight', [
                        new ButtonView({
                            type: 'v-Button--destructive v-Button--size13',
                            label: loc( 'Cancel' ),
                            target: popOver,
                            method: 'hide',
                        }),
                        new ButtonView({
                            type: 'v-Button--constructive v-Button--size13',
                            label: loc( 'Add Link' ),
                            target: this,
                            method: 'addLink',
                        }),
                    ]),
                ];
            },
            focus: function () {
                if ( this.get( 'isInDocument' ) ) {
                    this._input.set( 'selection', this.get( 'value' ).length )
                               .focus();
                    // Safari 6 doesn't fire this event for some reason.
                    this._input.fire( 'focus' );
                }
            }.nextFrame().observes( 'isInDocument' ),
            addLinkOnEnter: function ( event ) {
                event.stopPropagation();
                if ( lookupKey( event ) === 'enter' ) {
                    this.addLink();
                }
            }.on( 'keyup' ),
            addLink () {
                let url = this.get( 'value' ).trim(),
                    email;
                // Don't allow malicious links
                if ( /^(?:javascript|data):/i.test( url ) ) {
                    return;
                }
                // If it appears to start with a url protocol,
                // pass it through verbatim.
                if ( !( /[a-z][\w-]+:/i.test( url ) ) ) {
                    // Otherwise, look for an email address,
                    // and add a mailto: handler, if found.
                    email = emailRegExp.exec( url );
                    if ( email ) {
                        url = 'mailto:' + email[0];
                    }
                    // Or an http:// prefix if not.
                    else {
                        url = 'http://' + url;
                    }
                }
                richTextView.makeLink( url );
                popOver.hide();
                richTextView.focus();
            },
        });
    }.property(),

    showLinkOverlay ( buttonView ) {
        const view = this.get( 'linkOverlayView' );
        let value = this.getSelectedText().trim();
        if ( !urlRegExp.test( value ) && !emailRegExp.test( value ) ) {
            value = '';
        }
        view.set( 'value', value );
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view,
            alignWithView: buttonView,
            showCallout: true,
            offsetTop: 2,
            offsetLeft: -4,
        });
    },

    // --- Commands ---

    focus () {
        const editor = this.get( 'editor' );
        if ( editor ) {
            editor.focus();
        }
        return this;
    },

    blur () {
        const editor = this.get( 'editor' );
        if ( editor ) {
            editor.blur();
        }
        return this;
    },

    undo: execCommand( 'undo' ),
    redo: execCommand( 'redo' ),

    bold: execCommand( 'bold' ),
    italic: execCommand( 'italic' ),
    underline: execCommand( 'underline' ),
    strikethrough: execCommand( 'strikethrough' ),

    removeBold: execCommand( 'removeBold' ),
    removeItalic: execCommand( 'removeItalic' ),
    removeUnderline: execCommand( 'removeUnderline' ),
    removeStrikethrough: execCommand( 'removeStrikethrough' ),

    makeLink: execCommand( 'makeLink' ),
    removeLink: execCommand( 'removeLink' ),

    setFontFace: execCommand( 'setFontFace' ),
    setFontSize: execCommand( 'setFontSize' ),

    setTextColor: execCommand( 'setTextColour' ),
    setHighlightColor: execCommand( 'setHighlightColour' ),

    setTextAlignment: execCommand( 'setTextAlignment' ),
    setTextDirection: execCommand( 'setTextDirection' ),

    increaseQuoteLevel: execCommand( 'increaseQuoteLevel' ),
    decreaseQuoteLevel: execCommand( 'decreaseQuoteLevel' ),

    makeUnorderedList: execCommand( 'makeUnorderedList' ),
    makeOrderedList: execCommand( 'makeOrderedList' ),
    removeList: execCommand( 'removeList' ),

    increaseListLevel: execCommand( 'increaseListLevel' ),
    decreaseListLevel: execCommand( 'decreaseListLevel' ),

    removeAllFormatting: execCommand( 'removeAllFormatting' ),

    insertImage: execCommand( 'insertImage' ),
    insertImagesFromFiles ( files ) {
        if ( window.FileReader ) {
            files.forEach( file => {
                const img = this.get( 'editor' ).insertImage();
                const reader = new FileReader();
                reader.onload = () => {
                    img.src = reader.result;
                    reader.onload = null;
                };
                reader.readAsDataURL( file );
            });
        }
    },

    getSelectedText () {
        const editor = this.get( 'editor' );
        return editor ? editor.getSelectedText() : '';
    },

    kbShortcuts: function ( event ) {
        const isMac = UA.isMac;
        switch ( lookupKey( event ) ) {
        case isMac ? 'meta-k' : 'ctrl-k':
            event.preventDefault();
            this.showLinkOverlay(
                this.get( 'toolbarView' ).getView( 'link' )
            );
            break;
        case 'pagedown':
            if ( !isMac ) {
                const scrollView = this.getParent( ScrollView );
                if ( scrollView ) {
                    scrollView.scrollToView( this, {
                        y: 32 +
                            this.get( 'pxHeight' ) -
                            scrollView.get( 'pxHeight' ),
                    }, true );
                }
            }
            break;
        }
    }.on( 'keydown' ),

    // Low level commands

    _forEachBlock: execCommand( 'forEachBlock' ),

    // --- Command state ---

    canUndo: false,
    canRedo: false,

    setUndoState: function ( event ) {
        this.set( 'canUndo', event.canUndo )
            .set( 'canRedo', event.canRedo );
        event.stopPropagation();
    }.on( 'undoStateChange' ),

    path: '',

    setPath: function ( event ) {
        this.set( 'path', event.path );
        event.stopPropagation();
    }.on( 'pathChange' ),

    onSelect: function () {
        this.propertyDidChange( 'path' );
    }.on( 'select' ),

    isBold: queryCommandState( 'B' ),
    isItalic: queryCommandState( 'I' ),
    isUnderlined: queryCommandState( 'U' ),
    isStriked: queryCommandState( 'S' ),
    isLink: queryCommandState( 'A' ),

    alignment: function () {
        const path = this.get( 'path' );
        const results = /\.align-(\w+)/.exec( path );
        let alignment;
        if ( path === '(selection)' ) {
            alignment = '';
            this._forEachBlock( block => {
                const align = block.style.textAlign || 'left';
                if ( alignment && align !== alignment ) {
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
    }.property( 'path' ),

    direction: function () {
        const path = this.get( 'path' );
        const results = /\[dir=(\w+)\]/.exec( path );
        let dir;
        if ( path === '(selection)' ) {
            dir = '';
            this._forEachBlock( block => {
                const blockDir = block.dir || 'ltr';
                if ( dir && blockDir !== dir ) {
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
    }.property( 'path' ),

    isUnorderedList: queryCommandState( 'UL' ),
    isOrderedList: queryCommandState( 'OL' ),

    // --- Keep state in sync with render ---

    handleEvent ( event ) {
        // Ignore real dragover/drop events from Squire. They wil be handled
        // by the standard event delegation system. We only observe these
        // to get the image paste fake dragover/drop events.
        const type = event.type;
        if ( ( type === 'dragover' || type === 'drop' ) &&
                event.stopPropagation ) {
            return;
        }
        ViewEventsController.handleEvent( event, this );
    },

    _onFocus: function () {
        this.set( 'isFocussed', true );
    }.on( 'focus' ),

    _onBlur: function () {
        this.set( 'isFocussed', false );
    }.on( 'blur' ),

    blurOnEsc: function ( event ) {
        // If key == esc, we want to blur. Not all browsers do this
        // automatically.
        if ( ( event.keyCode || event.which ) === 27 ) {
            this.blur();
        }
    }.on( 'keydown' ),

    // -- Drag and drop ---

    dropAcceptedDataTypes: {
        'image/gif': true,
        'image/jpeg': true,
        'image/png': true,
        'image/tiff': true,
    },

    dropEffect: DragEffect.COPY,

    drop ( drag ) {
        const types = this.get( 'dropAcceptedDataTypes' );
        for ( const type in types ) {
            if ( drag.hasDataType( type ) ) {
                this.insertImagesFromFiles( drag.getFiles( /^image\/.*/ ) );
                break;
            }
        }
    },
});

RichTextView.isSupported = (
    ( 'contentEditable' in document.body ) &&
    // Opera Mobile. Yeh, no.
    ( !UA.operaMobile ) &&
    // Windows Phone as of v8.1 (IE11) is still pretty buggy
    ( !UA.isWinPhone ) &&
    // WKWebView (introduced in iOS8) finally supports RTV without horrendous
    // bugs.
    ( !UA.isIOS || UA.isWKWebView )
);

RichTextView.TOOLBAR_HIDDEN = TOOLBAR_HIDDEN;
RichTextView.TOOLBAR_AT_SELECTION = TOOLBAR_AT_SELECTION;
RichTextView.TOOLBAR_AT_TOP = TOOLBAR_AT_TOP;

export default RichTextView;
