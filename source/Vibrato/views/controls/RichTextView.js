// -------------------------------------------------------------------------- \\
// File: RichTextView.js                                                      \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, PopOverView.js                            \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS, undefined ) {

var execCommand = function ( command ) {
    return function ( arg ) {
        var editor = this.get( 'editor' );
        if ( editor ) {
            editor[ command ]( arg );
        }
        return this;
    };
};

var queryCommandState = function ( tag, regexp ) {
    return function () {
        var path = this.get( 'path' );
        return path === '(selection)' ?
            this.get( 'editor' )
                .hasFormat( tag ) : ( regexp ).test( path );
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

var RichTextView = NS.Class({

    Extends: NS.View,

    isFocussed: false,

    editor: null,

    styles: null,

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

    // --- Render ---

    willAppendLayerToDocument: function () {
        NS.Element.removeClass( this._loadingOverlay, 'hidden' );
        return RichTextView.parent
                .willAppendLayerToDocument.call( this );
    },

    willRemoveLayerFromDocument: function () {
        // As soon as the view is removed from the document, any editor
        // reference is no longer valid, as the iframe will have been unloaded.
        // The reference will be recreated when the iframe is appended
        // again. Must cache the value before it is removed though.
        var editor = this.get( 'editor' );
        if ( editor ) {
            this._value = editor.getHTML();
            this.set( 'editor', null );
        }
        return RichTextView.parent
                .willRemoveLayerFromDocument.call( this );
    },

    className: 'RichTextView' + ( NS.UA.isIOS ? ' iOS' : '' ),

    _render: function ( layer ) {
        var el = NS.Element.create,
            richTextView = this;

        // Editor
        var iframe = el( 'iframe', {
            src: RichTextView.pathToDocument,
            // IE8 ignores the CSS telling it not to give the iframe a border.
            frameborder: 0
        });
        var onload = function () {
            var win = iframe.contentWindow,
                editor = win.editor;
            if ( !editor ) {
                win.onEditorLoad = onload;
            } else {
                richTextView.set( 'editor', editor
                    .addStyles( richTextView.get( 'styles' ) )
                    .setHTML( richTextView._value )
                    .addEventListener( 'keydown', richTextView )
                    .addEventListener( 'keypress', richTextView )
                    .addEventListener( 'keyup', richTextView )
                    .addEventListener( 'mousedown', richTextView )
                    .addEventListener( 'click', richTextView )
                    .addEventListener( 'focus', richTextView )
                    .addEventListener( 'blur', richTextView )
                    .addEventListener( 'input', richTextView )
                    .addEventListener( 'select', richTextView )
                    .addEventListener( 'pathChange', richTextView )
                    .addEventListener( 'undoStateChange', richTextView )
                );
                NS.Element.addClass( richTextView._loadingOverlay, 'hidden' );
                if ( richTextView.get( 'isFocussed' ) ) {
                    editor.focus();
                }
            }
        }.invokeInRunLoop();

        iframe.addEventListener( 'load', onload, false );

        NS.Element.appendChildren( layer, [
            this.get( 'toolbarView' ),
            el( 'div.editor', [ iframe ] ),
            this._loadingOverlay = el( 'div.LoadingAnimation' )
        ]);
    },

    toolbarView: function () {
        var bind = NS.bind,
            richTextView = this;

        return new NS.ToolbarView({
            className: 'ToolbarView small',
            preventOverlap: true
        }).registerViews({
            bold: new ButtonView({
                isActive: bind( 'isBold', this ),
                label: NS.loc( 'Bold' ),
                type: 'iconOnly',
                icon: 'bold',
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
                isActive: bind( 'isItalic', this ),
                label: NS.loc( 'Italic' ),
                type: 'iconOnly',
                icon: 'italic',
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
                isActive: bind( 'isUnderlined', this ),
                label: NS.loc( 'Underline' ),
                type: 'iconOnly',
                icon: 'underline',
                activate: function () {
                    if ( richTextView.get( 'isUnderlined' ) ) {
                        richTextView.removeUnderline();
                    } else {
                        richTextView.underline();
                    }
                    this.fire( 'button:activate' );
                }
            }),
            size: new ButtonView({
                label: NS.loc( 'Font Size' ),
                type: 'iconOnly',
                icon: 'fontSize',
                target: this,
                method: 'showFontSizeMenu'
            }),
            font: new ButtonView({
                label: NS.loc( 'Font Face' ),
                type: 'iconOnly',
                icon: 'fontFace',
                target: this,
                method: 'showFontFaceMenu'
            }),
            colour: new ButtonView({
                label: NS.loc( 'Text Color' ),
                type: 'iconOnly',
                icon: 'textColour',
                target: this,
                method: 'showTextColourMenu'
            }),
            bgcolour: new ButtonView({
                label: NS.loc( 'Text Highlight' ),
                type: 'iconOnly',
                icon: 'highlightColour',
                target: this,
                method: 'showTextHighlightColourMenu'
            }),
            link: new ButtonView({
                isActive: bind( 'isLink', this ),
                label: NS.loc( 'Link' ),
                type: 'iconOnly',
                icon: 'link',
                activate: function () {
                    if ( richTextView.get( 'isLink' ) ) {
                        richTextView.removeLink();
                    } else {
                        richTextView.showLinkOverlay( this );
                    }
                    this.fire( 'button:activate' );
                }
            }),
            left: new ButtonView({
                isActive: bind( 'alignment', this, equalTo( 'left' ) ),
                label: NS.loc( 'Left' ),
                type: 'iconOnly',
                icon: 'alignLeft',
                activate: function () {
                    richTextView.setTextAlignment( 'left' );
                    this.fire( 'button:activate' );
                }
            }),
            centre: new ButtonView({
                isActive: bind( 'alignment', this, equalTo( 'center' ) ),
                label: NS.loc( 'Center' ),
                type: 'iconOnly',
                icon: 'alignCentre',
                activate: function () {
                    richTextView.setTextAlignment( 'center' );
                    this.fire( 'button:activate' );
                }
            }),
            right: new ButtonView({
                isActive: bind( 'alignment', this, equalTo( 'right' ) ),
                label: NS.loc( 'Right' ),
                type: 'iconOnly',
                icon: 'alignRight',
                activate: function () {
                    richTextView.setTextAlignment( 'right' );
                    this.fire( 'button:activate' );
                }
            }),
            justify: new ButtonView({
                isActive: bind( 'alignment', this, equalTo( 'justify' ) ),
                label: NS.loc( 'Justify' ),
                type: 'iconOnly',
                icon: 'alignJustify',
                activate: function () {
                    richTextView.setTextAlignment( 'justify' );
                    this.fire( 'button:activate' );
                }
            }),
            quote: new ButtonView({
                label: NS.loc( 'Quote' ),
                type: 'iconOnly',
                icon: 'incQuote',
                target: richTextView,
                method: 'increaseQuoteLevel'
            }),
            unquote: new ButtonView({
                label: NS.loc( 'Unquote' ),
                type: 'iconOnly',
                icon: 'decQuote',
                target: richTextView,
                method: 'decreaseQuoteLevel'
            }),
            ul: new ButtonView({
                isActive: bind( 'isUnorderedList', this ),
                label: NS.loc( 'Unordered List' ),
                type: 'iconOnly',
                icon: 'ul',
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
                isActive: bind( 'isOrderedList', this ),
                label: NS.loc( 'Ordered List' ),
                type: 'iconOnly',
                icon: 'ol',
                activate: function () {
                    if ( richTextView.get( 'isOrderedList' ) ) {
                        richTextView.removeList();
                    } else {
                        richTextView.makeOrderedList();
                    }
                    this.fire( 'button:activate' );
                }
            })
        }).registerConfig( 'standard', {
            left: [ 'bold', 'italic', 'underline', '-',
                    'size', 'font', '-',
                    'colour', 'bgcolour', '-',
                    'link', '-',
                    'left', 'centre', 'right', 'justify', '-',
                    'quote', 'unquote', '-',
                    'ul', 'ol'
                  ],
            right: []
        });
    }.property(),

    fontSizeMenuView: function () {
        var richTextView = this;
        return new NS.MenuView({
            showFilter: false,
            options: [
                [ NS.loc( 'Small' ), '10px'  ],
                [ NS.loc( 'Medium' ), '13px' ],
                [ NS.loc( 'Large' ), '16px'  ],
                [ NS.loc( 'Huge' ), '22px'   ]
            ].map( function ( item ) {
                return new ButtonView({
                    label: item[0],
                    layout: {
                        fontSize: item[1]
                    },
                    method: 'setFontSize',
                    setFontSize: function () {
                        richTextView.setFontSize( item[1] );
                    }
                });
            })
        });
    }.property(),

    showFontSizeMenu: function ( buttonView ) {
        popOver.show({
            view: this.get( 'fontSizeMenuView' ),
            alignWithView: buttonView,
            withEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    fontFaceMenuView: function () {
        var richTextView = this;
        return new NS.MenuView({
            showFilter: false,
            options: [
                [ 'Arial', 'arial, sans-serif' ],
                [ 'Georgia', 'georgia, serif' ],
                [ 'Helvetica', 'helvetica, arial, sans-serif' ],
                [ 'Monospace', 'menlo, consolas, "courier new", monospace' ],
                [ 'Times New Roman', '"Times New Roman", times, serif' ],
                [ 'Trebuchet MS', '"Trebuchet MS", sans-serif' ],
                [ 'Verdana', 'verdana, sans-serif' ]
            ].map( function ( item ) {
                return new ButtonView({
                    label: item[0],
                    layout: {
                        fontFamily: item[1]
                    },
                    method: 'setFontFace',
                    setFontFace: function () {
                        richTextView.setFontFace( item[1] );
                    }
                });
            })
        });
    }.property(),

    showFontFaceMenu: function ( buttonView ) {
        popOver.show({
            view: this.get( 'fontFaceMenuView' ),
            alignWithView: buttonView,
            withEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    _colourText: true,

    textColourMenuView: function () {
        var richTextView = this;
        return new NS.MenuView({
            className: 'ColourMenuView',
            showFilter: false,
            options: ( '#000000 #777672 #a9a8a1 #d7d4c0 #ffffff ' +
                       '#3b641a #56a3cb #88c5c8 #a0dca0 #d0f652 ' +
                       '#0018a8 #3880ad #4b9293 #68a65e #99b446 ' +
                       '#683c2d #753381 #a54062 #bd433d #e4b150 ' +
                       '#381b9a #7561ac #e36a95 #e56d69 #ffe60c' )
                .split( ' ' )
                .map( function ( colour, index ) {
                    return new ButtonView({
                        label: colour,
                        layout: {
                            backgroundColor: colour
                        },
                        method: 'setColour',
                        setColour: function () {
                            if ( richTextView._colourText ) {
                                richTextView.setTextColour( colour );
                            } else {
                                richTextView.setHighlightColour( colour );
                            }
                        }
                    });
                })
        });
    }.property(),

    showTextColourMenu: function ( buttonView ) {
        this._colourText = true;
        popOver.show({
            view: this.get( 'textColourMenuView' ),
            alignWithView: buttonView,
            withEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    showTextHighlightColourMenu: function ( buttonView ) {
        this._colourText = false;
        popOver.show({
            view: this.get( 'textColourMenuView' ),
            alignWithView: buttonView,
            withEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    linkOverlayView: function () {
        var richTextView = this;
        return new NS.View({
            className: 'URLPopOver',
            value: '',
            didAppendLayerToDocument: function () {
                this._input.set( 'selection', this.get( 'value' ).length )
                           .focus();
                // IE8 doesn't fire this event for some reason.
                if ( NS.UA.msie === 8 ) {
                    this._input.fire( 'focus' );
                }
                return NS.View.prototype.didAppendLayerToDocument.call( this );
            },
            addLink: function ( event ) {
                event.stopPropagation();
                if ( event.type === 'keyup' &&
                        NS.DOMEvent.lookupKey( event ) !== 'enter' ) {
                    return;
                }
                var url = this.get( 'value' ).trim(),
                    email;
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
            }.on( 'addLink', 'keyup' ),
            _render: function ( layer ) {
                var Element = NS.Element,
                    el = Element.create;
                Element.appendChildren( layer, [
                    el( 'p', [
                        NS.loc( 'Add a link to the following URL or email:' )
                    ]),
                    this._input = new NS.TextView({
                        value: new NS.Binding({
                            isTwoWay: true
                        }).from( 'value', this ),
                        placeholder: 'e.g. www.example.com'
                    }),
                    el( 'p.right', [
                        new ButtonView({
                            type: 'destructive button size13',
                            label: NS.loc( 'Cancel' ),
                            target: popOver,
                            method: 'hide'
                        }),
                        new ButtonView({
                            type: 'constructive button size13',
                            label: NS.loc( 'Add Link' ),
                            target: this,
                            action: 'addLink'
                        })
                    ])
                ]);
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
        } else {
            this.set( 'isFocussed', true );
        }
        return this;
    },

    blur: function () {
        var editor = this.get( 'editor' );
        if ( editor ) {
            editor.focus();
        } else {
            this.set( 'isFocussed', false );
        }
        return this;
    },

    undo: execCommand( 'undo' ),
    redo: execCommand( 'redo' ),

    bold: execCommand( 'bold' ),
    italic: execCommand( 'italic' ),
    underline: execCommand( 'underline' ),

    removeBold: execCommand( 'removeBold' ),
    removeItalic: execCommand( 'removeItalic' ),
    removeUnderline: execCommand( 'removeUnderline' ),

    makeLink: execCommand( 'makeLink' ),
    removeLink: execCommand( 'removeLink' ),

    setFontFace: execCommand( 'setFontFace' ),
    setFontSize: execCommand( 'setFontSize' ),

    setTextColour: execCommand( 'setTextColour' ),
    setHighlightColour: execCommand( 'setHighlightColour' ),

    setTextAlignment: execCommand( 'setTextAlignment' ),

    increaseQuoteLevel: execCommand( 'increaseQuoteLevel' ),
    decreaseQuoteLevel: execCommand( 'decreaseQuoteLevel' ),

    makeUnorderedList: execCommand( 'makeUnorderedList' ),
    makeOrderedList: execCommand( 'makeOrderedList' ),
    removeList: execCommand( 'removeList' ),

    insertImage: execCommand( 'insertImage' ),

    getSelectedText: function () {
        var editor = this.get( 'editor' );
        return editor ? editor.getSelectedText() : '';
    },

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

    onSelect: function ( event ) {
        this.propertyDidChange( 'path' );
    }.on( 'select' ),

    isBold: queryCommandState( 'B', ( />B\b/ ) ),
    isItalic: queryCommandState( 'I', ( />I\b/ ) ),
    isUnderlined: queryCommandState( 'U', ( />U\b/ ) ),
    isLink: queryCommandState( 'A', ( />A\b/ ) ),

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

    isUnorderedList: queryCommandState( 'UL', ( />UL\b/ ) ),
    isOrderedList: queryCommandState( 'OL', ( />OL\b/ ) ),

    // --- Keep state in sync with render ---

    handleEvent: function ( event ) {
        NS.RootViewController.handleEvent( event, this );
    },

    _onFocus: function () {
        this.set( 'isFocussed', true );
    }.on( 'focus' ),

    _onBlur: function () {
        this.set( 'isFocussed', false );
    }.on( 'blur' ),

    _onKeypress: function ( event ) {
        // Stop event from getting to KB shortcuts handler.
        event.stopPropagation();
        // If key == esc, we want to blur. Not all browsers do this
        // automatically.
        if ( ( event.keyCode || event.which ) === 27 ) {
            this.blur();
        }
    }.on( 'keypress' )
});

RichTextView.pathToDocument = 'document.html';

RichTextView.isSupported = !!(
    ( 'contentEditable' in document.body ) &&
    ( !NS.UA.operaMobile ) &&
    ( !NS.UA.isIOS || NS.UA.version >= 6 )
);

NS.RichTextView = RichTextView;

}( this.O ) );
