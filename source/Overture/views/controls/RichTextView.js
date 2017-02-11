// -------------------------------------------------------------------------- \\
// File: RichTextView.js                                                      \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, PanelViews, DragDrop                \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global window, document, FileReader, Squire */

"use strict";

( function ( NS, window, document, undefined ) {

var execCommand = function ( command ) {
    return function ( arg ) {
        var editor = this.get( 'editor' );
        if ( editor ) {
            editor[ command ]( arg );
        }
        return this;
    };
};

var queryCommandState = function ( tag ) {
    var regexp = new RegExp( '(?:^|>)' + tag + '\\b' );
    return function () {
        var path = this.get( 'path' );
        return path === '(selection)' ?
            this.get( 'editor' ).hasFormat( tag ) :
            regexp.test( path );
    }.property( 'path' );
};

var emailRegExp = RegExp.email,
    // Use a more relaxed definition of a URL than normal; anything URL-like we
    // want to accept so we can prefill the link destination box.
    urlRegExp =
        /^(?:https?:\/\/)?[\w.]+[.][a-z]{2,4}(?:\/[^\s()<>]+|\([^\s()<>]+\))*/i;

var popOver = new NS.PopOverView();

var ButtonView = NS.ButtonView;
var equalTo = NS.Transform.isEqualToValue;
var UA = NS.UA;

var RichTextView = NS.Class({

    Extends: NS.View,

    Mixin: NS.DropTarget,

    isFocussed: false,

    allowTextSelection: true,

    showToolbar: !UA.isIOS,
    fontFaceOptions: [
        [ 'Default', null ],
        [ 'Arial', 'arial, sans-serif' ],
        [ 'Georgia', 'georgia, serif' ],
        [ 'Helvetica', 'helvetica, arial, sans-serif' ],
        [ 'Monospace', 'menlo, consolas, monospace' ],
        [ 'Tahoma', 'tahoma, sans-serif' ],
        [ 'Times New Roman', '"Times New Roman", times, serif' ],
        [ 'Trebuchet MS', '"Trebuchet MS", sans-serif' ],
        [ 'Verdana', 'verdana, sans-serif' ]
    ],
    fontSizeOptions: function () {
        return [
            [ NS.loc( 'Small' ), '10px' ],
            [ NS.loc( 'Medium' ), null  ],
            [ NS.loc( 'Large' ), '16px' ],
            [ NS.loc( 'Huge' ),  '22px' ]
        ];
    }.property(),

    editor: null,
    editorClassName: '',
    styles: null,
    blockDefaults: null,

    _value: '',
    value: function ( html ) {
        var editor = this.get( 'editor' );
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

    destroy: function () {
        var editor = this.get( 'editor' );
        if ( editor ) {
            editor.destroy();
        }
        RichTextView.parent.destroy.call( this );
    },

    // --- Render ---

    willEnterDocument: function () {
        this.set( 'path', '' );
        RichTextView.parent.willEnterDocument.call( this );
        this.get( 'layer' ).appendChild( this._editingLayer );
        return this;
    },

    didEnterDocument: function () {
        var scrollView = this.getParent( NS.ScrollView );
        if ( scrollView ) {
            if ( this.get( 'showToolbar' ) ) {
                scrollView.addObserverForKey(
                    'scrollTop', this, '_calcToolbarPosition' );
            }
            if ( NS.UA.isIOS ) {
                scrollView.addObserverForKey(
                    'scrollTop', this, 'redrawIOSCursor' );
            }
        }
        return RichTextView.parent.didEnterDocument.call( this );
    },

    willLeaveDocument: function () {
        var scrollView = this.getParent( NS.ScrollView );
        if ( scrollView ) {
            if ( this.get( 'showToolbar' ) ) {
                scrollView.removeObserverForKey(
                    'scrollTop', this, '_calcToolbarPosition' );
                this._setToolbarPosition(
                    scrollView, this.get( 'toolbarView' ), false );
            }
            if ( NS.UA.isIOS ) {
                scrollView.removeObserverForKey(
                    'scrollTop', this, 'redrawIOSCursor' );
            }
        }
        return RichTextView.parent.willLeaveDocument.call( this );
    },

    didLeaveDocument: function () {
        // The nodes must be in a document or document fragment for DOM Range
        // API to work; otherwise will throw INVALID_NODE_TYPE_ERR errors.
        // This is important if the value is changed before appending.
        document.createDocumentFragment().appendChild( this._editingLayer );
        return RichTextView.parent.didLeaveDocument.call( this );
    },

    // ---

    className: function () {
        return 'v-RichText' +
            ( this.get( 'showToolbar' ) ? '' : ' v-RichText--noToolbar' );
    }.property(),

    draw: function ( layer, Element, el ) {
        var editorClassName = this.get( 'editorClassName' );
        var editingLayer = this._editingLayer = el( 'div', {
            className: 'v-RichText-input' +
                ( editorClassName ? ' ' + editorClassName : '' )
        });
        // The nodes must be in a document or document fragment for DOM Range
        // API to work; otherwise will throw INVALID_NODE_TYPE_ERR errors.
        document.createDocumentFragment().appendChild( editingLayer );
        var editor = new Squire( editingLayer, this.get( 'blockDefaults' ) );
        editor
            .setHTML( this._value )
            .addEventListener( 'input', this )
            .addEventListener( 'select', this )
            .addEventListener( 'pathChange', this )
            .addEventListener( 'undoStateChange', this )
            .addEventListener( 'dragover', this )
            .addEventListener( 'drop', this )
            .didError = NS.RunLoop.didError;
        this.set( 'editor', editor )
            .set( 'path', editor.getPath() );
        return [
            el( 'style', { type: 'text/css' }, [
                this.get( 'styles' )
            ]),
            this.get( 'showToolbar' ) ? this.get( 'toolbarView' ) : null
        ];
    },

    // ---

    redrawIOSCursor: function () {
        if ( this.get( 'isFocussed' ) ) {
            var editor = this.get( 'editor' );
            editor.setSelection( editor.getSelection() );
        }
    }.nextFrame(),

    scrollIntoView: function () {
        var scrollView = this.getParent( NS.ScrollView );
        var editor = this.get( 'editor' );
        var cursorPosition = editor && editor.getCursorPosition();
        if ( !scrollView || !cursorPosition ) {
            return;
        }
        var scrollViewOffsetTop =
            scrollView.get( 'layer' ).getBoundingClientRect().top;
        var offsetTop = cursorPosition.top - scrollViewOffsetTop;
        var offsetBottom = cursorPosition.bottom - scrollViewOffsetTop;
        var scrollViewHeight = scrollView.get( 'pxHeight' );
        var scrollBy = 0;
        if ( NS.UA.isIOS ) {
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
    }.queue( 'after' ).on( 'input' ),

    _calcToolbarPosition: function ( scrollView, _, __, scrollTop ) {
        var toolbarView = this.get( 'toolbarView' ),
            offsetHeight = this._offsetHeight,
            offsetTop = this._offsetTop,
            now = Date.now(),
            wasSticky = toolbarView.get( 'parentView' ) !== this,
            isSticky;

        // For performance, cache the size and position for 1/2 second from last
        // use.
        if ( !offsetTop || this._offsetExpiry < now ) {
            this._offsetHeight = offsetHeight =
                this.get( 'layer' ).offsetHeight;
            this._offsetTop = offsetTop =
                Math.floor( this.getPositionRelativeTo( scrollView ).top );
        }
        this._offsetExpiry = now + 500;

        isSticky =
            scrollTop > offsetTop &&
            scrollTop < offsetTop + offsetHeight -
                ( scrollView.get( 'pxHeight' ) >> 2 );

        if ( isSticky !== wasSticky ) {
            this._setToolbarPosition( scrollView, toolbarView, isSticky );
        }
    },
    _setToolbarPosition: function ( scrollView, toolbarView, isSticky ) {
        if ( isSticky ) {
            var newParent = scrollView.get( 'parentView' ),
                position = toolbarView.getPositionRelativeTo( newParent ),
                // Need to account separately for any border in the new parent.
                borders = scrollView.getPositionRelativeTo( newParent );
            toolbarView
                .set( 'layout', {
                    top: scrollView.get( 'pxTop' ),
                    left: position.left - borders.left,
                    width: toolbarView.get( 'pxWidth' )
                });
            newParent.insertView( toolbarView );
        } else {
            toolbarView
                .set( 'layout', {
                    top: 0,
                    left: 0,
                    right: 0
                });
            this.insertView( toolbarView, null, 'top' );
        }
    },

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
            'unformat'
        ],
        right: []
    },

    toolbarView: function () {
        var bind = NS.bind,
            richTextView = this;

        return new NS.ToolbarView({
            className: 'v-Toolbar v-RichText-toolbar',
            positioning: 'absolute',
            layout: {
                overflow: 'hidden',
                zIndex: 1,
                top: 0,
                left: 0,
                right: 0
            },
            preventOverlap: true
        }).registerViews({
            bold: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-bold',
                isActive: bind( 'isBold', this ),
                label: NS.loc( 'Bold' ),
                tooltip: NS.loc( 'Bold' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-b' ),
                activate: function () {
                    if ( richTextView.get( 'isBold' ) ) {
                        richTextView.removeBold();
                    } else {
                        richTextView.bold();
                    }
                    this.fire( 'button:activate' );
                }
            }),
            italic: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-italic',
                isActive: bind( 'isItalic', this ),
                label: NS.loc( 'Italic' ),
                tooltip: NS.loc( 'Italic' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-i' ),
                activate: function () {
                    if ( richTextView.get( 'isItalic' ) ) {
                        richTextView.removeItalic();
                    } else {
                        richTextView.italic();
                    }
                    this.fire( 'button:activate' );
                }
            }),
            underline: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-underline',
                isActive: bind( 'isUnderlined', this ),
                label: NS.loc( 'Underline' ),
                tooltip: NS.loc( 'Underline' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-u' ),
                activate: function () {
                    if ( richTextView.get( 'isUnderlined' ) ) {
                        richTextView.removeUnderline();
                    } else {
                        richTextView.underline();
                    }
                    this.fire( 'button:activate' );
                }
            }),
            strikethrough: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-strikethrough',
                isActive: bind( 'isStriked', this ),
                label: NS.loc( 'Strikethrough' ),
                tooltip: NS.loc( 'Strikethrough' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-shift-7' ),
                activate: function () {
                    if ( richTextView.get( 'isStriked' ) ) {
                        richTextView.removeStrikethrough();
                    } else {
                        richTextView.strikethrough();
                    }
                    this.fire( 'button:activate' );
                }
            }),
            size: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-font-size',
                label: NS.loc( 'Font Size' ),
                tooltip: NS.loc( 'Font Size' ),
                target: this,
                method: 'showFontSizeMenu'
            }),
            font: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-font',
                label: NS.loc( 'Font Face' ),
                tooltip: NS.loc( 'Font Face' ),
                target: this,
                method: 'showFontFaceMenu'
            }),
            color: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-palette',
                label: NS.loc( 'Text Color' ),
                tooltip: NS.loc( 'Text Color' ),
                target: this,
                method: 'showTextColorMenu'
            }),
            bgcolor: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-highlight',
                label: NS.loc( 'Text Highlight' ),
                tooltip: NS.loc( 'Text Highlight' ),
                target: this,
                method: 'showTextHighlightColorMenu'
            }),
            link: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-link',
                isActive: bind( 'isLink', this ),
                label: NS.loc( 'Link' ),
                tooltip: NS.loc( 'Link' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-k' ),
                activate: function () {
                    if ( richTextView.get( 'isLink' ) ) {
                        richTextView.removeLink();
                    } else {
                        richTextView.showLinkOverlay( this );
                    }
                    this.fire( 'button:activate' );
                }
            }),
            image: new NS.FileButtonView({
                type: 'v-FileButton v-Button--iconOnly',
                icon: 'icon-image',
                label: NS.loc( 'Insert Image' ),
                tooltip: NS.loc( 'Insert Image' ),
                acceptMultiple: true,
                acceptOnlyTypes: 'image/jpeg, image/png, image/gif',
                target: this,
                method: 'insertImagesFromFiles'
            }),
            left: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-paragraph-left',
                isActive: bind( 'alignment', this, equalTo( 'left' ) ),
                label: NS.loc( 'Left' ),
                tooltip: NS.loc( 'Left' ),
                activate: function () {
                    richTextView.setTextAlignment( 'left' );
                    this.fire( 'button:activate' );
                }
            }),
            centre: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-paragraph-centre',
                isActive: bind( 'alignment', this, equalTo( 'center' ) ),
                label: NS.loc( 'Center' ),
                tooltip: NS.loc( 'Center' ),
                activate: function () {
                    richTextView.setTextAlignment( 'center' );
                    this.fire( 'button:activate' );
                }
            }),
            right: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-paragraph-right',
                isActive: bind( 'alignment', this, equalTo( 'right' ) ),
                label: NS.loc( 'Right' ),
                tooltip: NS.loc( 'Right' ),
                activate: function () {
                    richTextView.setTextAlignment( 'right' );
                    this.fire( 'button:activate' );
                }
            }),
            justify: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-paragraph-justify',
                isActive: bind( 'alignment', this, equalTo( 'justify' ) ),
                label: NS.loc( 'Justify' ),
                tooltip: NS.loc( 'Justify' ),
                activate: function () {
                    richTextView.setTextAlignment( 'justify' );
                    this.fire( 'button:activate' );
                }
            }),
            ltr: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-lefttoright',
                isActive: bind( 'direction', this, equalTo( 'ltr' ) ),
                label: NS.loc( 'Text Direction: Left to Right' ),
                tooltip: NS.loc( 'Text Direction: Left to Right' ),
                activate: function () {
                    richTextView.setTextDirection( 'ltr' );
                    this.fire( 'button:activate' );
                }
            }),
            rtl: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-righttoleft',
                isActive: bind( 'direction', this, equalTo( 'rtl' ) ),
                label: NS.loc( 'Text Direction: Right to Left' ),
                tooltip: NS.loc( 'Text Direction: Right to Left' ),
                activate: function () {
                    richTextView.setTextDirection( 'rtl' );
                    this.fire( 'button:activate' );
                }
            }),
            quote: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-quotes-left',
                label: NS.loc( 'Quote' ),
                tooltip: NS.loc( 'Quote' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-]' ),
                target: richTextView,
                method: 'increaseQuoteLevel'
            }),
            unquote: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-quotes-right',
                label: NS.loc( 'Unquote' ),
                tooltip: NS.loc( 'Unquote' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-[' ),
                target: richTextView,
                method: 'decreaseQuoteLevel'
            }),
            ul: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-list',
                isActive: bind( 'isUnorderedList', this ),
                label: NS.loc( 'Unordered List' ),
                tooltip: NS.loc( 'Unordered List' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-shift-8' ),
                activate: function () {
                    if ( richTextView.get( 'isUnorderedList' ) ) {
                        richTextView.removeList();
                    } else {
                        richTextView.makeUnorderedList();
                    }
                    this.fire( 'button:activate' );
                }
            }),
            ol: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-numbered-list',
                isActive: bind( 'isOrderedList', this ),
                label: NS.loc( 'Ordered List' ),
                tooltip: NS.loc( 'Ordered List' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-shift-9' ),
                activate: function () {
                    if ( richTextView.get( 'isOrderedList' ) ) {
                        richTextView.removeList();
                    } else {
                        richTextView.makeOrderedList();
                    }
                    this.fire( 'button:activate' );
                }
            }),
            unformat: new ButtonView({
                type: 'v-Button--iconOnly',
                icon: 'icon-clear-formatting',
                label: NS.loc( 'Clear Formatting' ),
                tooltip: NS.loc( 'Clear Formatting' ),
                activate: function () {
                    richTextView.removeAllFormatting();
                    this.fire( 'button:activate' );
                }
            })
        }).registerConfig( 'standard', this.get( 'toolbarConfig' ) );
    }.property(),

    fontSizeMenuView: function () {
        var richTextView = this;
        return new NS.MenuView({
            showFilter: false,
            options: this.get( 'fontSizeOptions' ).map( function ( item ) {
                var fontSize = item[1];
                return new ButtonView({
                    layout: fontSize ? {
                        fontSize: fontSize
                    } : null,
                    label: item[0],
                    method: 'setFontSize',
                    setFontSize: function () {
                        richTextView.setFontSize( fontSize );
                    }
                });
            })
        });
    }.property(),

    showFontSizeMenu: function ( buttonView ) {
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( NS.MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view: this.get( 'fontSizeMenuView' ),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    fontFaceMenuView: function () {
        var richTextView = this;
        return new NS.MenuView({
            showFilter: false,
            options: this.get( 'fontFaceOptions' ).map( function ( item ) {
                var fontFace = item[1];
                return new ButtonView({
                    layout: fontFace ? {
                        fontFamily: fontFace
                    } : null,
                    label: item[0],
                    method: 'setFontFace',
                    setFontFace: function () {
                        richTextView.setFontFace( fontFace );
                    }
                });
            })
        });
    }.property(),

    showFontFaceMenu: function ( buttonView ) {
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( NS.MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view: this.get( 'fontFaceMenuView' ),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    _colorText: true,

    textColorMenuView: function () {
        var richTextView = this;
        return new NS.MenuView({
            className: 'v-ColorMenu',
            showFilter: false,
            options: (
                '000000 b22222 ff0000 ffa07a fff0f5 ' +
                '800000 a52a2a ff8c00 ffa500 faebd7 ' +
                '8b4513 daa520 ffd700 ffff00 ffffe0 ' +
                '2f4f4f 006400 008000 00ff00 f0fff0 ' +
                '008080 40e0d0 00ffff afeeee f0ffff ' +
                '000080 0000cd 0000ff add8e6 f0f8ff ' +
                '4b0082 800080 ee82ee dda0dd e6e6fa ' +
                '696969 808080 a9a9a9 d3d3d3 ffffff' )
                .split( ' ' )
                .map( function ( color ) {
                    color = '#' + color;
                    return new ButtonView({
                        layout: {
                            backgroundColor: color
                        },
                        label: color,
                        method: 'setColor',
                        setColor: function () {
                            if ( richTextView._colorText ) {
                                richTextView.setTextColor( color );
                            } else {
                                richTextView.setHighlightColor( color );
                            }
                        }
                    });
                })
        });
    }.property(),

    showTextColorMenu: function ( buttonView ) {
        this._colorText = true;
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( NS.MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view: this.get( 'textColorMenuView' ),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    showTextHighlightColorMenu: function ( buttonView ) {
        this._colorText = false;
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( NS.MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view: this.get( 'textColorMenuView' ),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    linkOverlayView: function () {
        var richTextView = this;
        return new NS.View({
            className: 'v-UrlPicker',
            value: '',
            draw: function ( layer, Element, el ) {
                return [
                    el( 'h3.u-bold', [
                        NS.loc( 'Add a link to the following URL or email:' )
                    ]),
                    this._input = new NS.TextView({
                        value: NS.bindTwoWay( 'value', this ),
                        placeholder: 'e.g. www.example.com'
                    }),
                    el( 'p.u-alignRight', [
                        new ButtonView({
                            type: 'v-Button--destructive v-Button--size13',
                            label: NS.loc( 'Cancel' ),
                            target: popOver,
                            method: 'hide'
                        }),
                        new ButtonView({
                            type: 'v-Button--constructive v-Button--size13',
                            label: NS.loc( 'Add Link' ),
                            target: this,
                            method: 'addLink'
                        })
                    ])
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
                if ( NS.DOMEvent.lookupKey( event ) === 'enter' ) {
                    this.addLink();
                }
            }.on( 'keyup' ),
            addLink: function () {
                var url = this.get( 'value' ).trim(),
                    email;
                // Don't allow malicious links
                if ( /^(?:javascript|data):/i.test( url ) ) {
                    return;
                }
                // If it appears to start with a url protocol,
                // pass it through verbatim.
                if ( !( /[a-z][\w\-]+:/i.test( url ) ) ) {
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
            }
        });
    }.property(),

    showLinkOverlay: function ( buttonView ) {
        var view = this.get( 'linkOverlayView' ),
            value = this.getSelectedText().trim();
        if ( !urlRegExp.test( value ) && !emailRegExp.test( value ) ) {
            value = '';
        }
        view.set( 'value', value );
        // If we're in the overflow menu, align with the "More" button.
        if ( buttonView.getParent( NS.MenuView ) ) {
            buttonView = this.get( 'toolbarView' ).getView( 'overflow' );
        }
        popOver.show({
            view: view,
            alignWithView: buttonView,
            showCallout: true,
            offsetTop: 2,
            offsetLeft: -4
        });
    },

    // --- Commands ---

    focus: function () {
        var editor = this.get( 'editor' );
        if ( editor ) {
            editor.focus();
        }
        return this;
    },

    blur: function () {
        var editor = this.get( 'editor' );
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
    insertImagesFromFiles: function ( files ) {
        if ( window.FileReader ) {
            files.forEach( function ( file ) {
                var img = this.get( 'editor' ).insertImage(),
                    reader = new FileReader();
                reader.onload = function () {
                    img.src = reader.result;
                    reader.onload = null;
                };
                reader.readAsDataURL( file );
            }, this );
        }
    },

    getSelectedText: function () {
        var editor = this.get( 'editor' );
        return editor ? editor.getSelectedText() : '';
    },

    kbShortcuts: function ( event ) {
        var isMac = UA.isMac;
        switch ( NS.DOMEvent.lookupKey( event ) ) {
        case isMac ? 'meta-k' : 'ctrl-k':
            event.preventDefault();
            this.showLinkOverlay(
                this.get( 'toolbarView' ).getView( 'link' )
            );
            break;
        case 'pagedown':
            if ( !isMac ) {
                var scrollView = this.getParent( NS.ScrollView );
                if ( scrollView ) {
                    scrollView.scrollToView( this, {
                        y: 32 +
                            this.get( 'pxHeight' ) -
                            scrollView.get( 'pxHeight' )
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
        var path = this.get( 'path' ),
            results = /\.align\-(\w+)/.exec( path ),
            alignment;
        if ( path === '(selection)' ) {
            alignment = '';
            this._forEachBlock( function ( block ) {
                var align = block.style.textAlign || 'left';
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
        var path = this.get( 'path' ),
            results = /\[dir=(\w+)\]/.exec( path ),
            dir;
        if ( path === '(selection)' ) {
            dir = '';
            this._forEachBlock( function ( block ) {
                var blockDir = block.dir || 'ltr';
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

    handleEvent: function ( event ) {
        // Ignore real dragover/drop events from Squire. They wil be handled
        // by the standard event delegation system. We only observe these
        // to get the image paste fake dragover/drop events.
        var type = event.type;
        if ( ( type === 'dragover' || type === 'drop' ) &&
                event.stopPropagation ) {
            return;
        }
        NS.ViewEventsController.handleEvent( event, this );
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
        'image/tiff': true
    },

    dropEffect: NS.DragEffect.COPY,

    drop: function ( drag ) {
        var types = this.get( 'dropAcceptedDataTypes' ),
            type;
        for ( type in types ) {
            if ( drag.hasDataType( type ) ) {
                this.insertImagesFromFiles( drag.getFiles( /^image\/.*/ ) );
                break;
            }
        }
    }
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

NS.RichTextView = RichTextView;

}( O, window, document ) );
