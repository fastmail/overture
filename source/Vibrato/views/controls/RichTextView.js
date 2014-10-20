// -------------------------------------------------------------------------- \\
// File: RichTextView.js                                                      \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, PanelViews, DragDrop                \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

/*global document, window, FileReader, Squire */

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

    Mixin: NS.DropTarget,

    isFocussed: false,
    isExpanding: false,

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

    willEnterDocument: function () {
        this.set( 'path', '' );
        return RichTextView.parent.willEnterDocument.call( this );
    },

    didEnterDocument: function () {
        if ( !NS.UA.isIOS && this.get( 'isExpanding' ) ) {
            var scrollView = this.getParent( NS.ScrollView );
            if ( scrollView ) {
                scrollView.addObserverForKey(
                    'scrollTop', this, '_calcToolbarPosition' );
            }
        }
        return RichTextView.parent.didEnterDocument.call( this );
    },

    willLeaveDocument: function () {
        if ( !NS.UA.isIOS && this.get( 'isExpanding' ) ) {
            var scrollView = this.getParent( NS.ScrollView );
            if ( scrollView ) {
                scrollView.removeObserverForKey(
                    'scrollTop', this, '_calcToolbarPosition' );
            }
            this._setToolbarPosition(
                scrollView, this.get( 'toolbarView' ), false );
        }
        // As soon as the view is removed from the document, any editor
        // reference is no longer valid, as the iframe will have been unloaded.
        // The reference will be recreated when the iframe is appended
        // again. Must cache the value before it is removed though.
        var editor = this.get( 'editor' );
        if ( editor ) {
            this._value = editor.getHTML( this.get( 'isFocussed' ) );
            editor.destroy();
            this.set( 'editor', null );
        }
        return RichTextView.parent.willLeaveDocument.call( this );
    },

    className: 'RichTextView' + ( NS.UA.isIOS ? ' iOS' : '' ),

    draw: function ( layer, Element, el ) {
        var richTextView = this;
        var iframe = el( 'iframe' );
        var onload = function () {
            // Make sure we're in standards mode.
            var doc = iframe.contentDocument;
            if ( doc.compatMode !== 'CSS1Compat' ) {
                doc.open();
                doc.write( '<!DOCTYPE html><title></title>' );
                doc.close();
            }
            // Create Squire instance
            var editor = new Squire( doc );
            editor.didError = NS.RunLoop.didError;
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
                .addEventListener( 'dragenter', richTextView )
                .addEventListener( 'dragleave', richTextView )
                .addEventListener( 'dragover', richTextView )
                .addEventListener( 'drop', richTextView )
                .addEventListener( 'select', richTextView )
                .addEventListener( 'pathChange', richTextView )
                .addEventListener( 'undoStateChange', richTextView )
            ).set( 'path', editor.getPath() )
             .expand();
            if ( richTextView.get( 'isFocussed' ) ) {
                editor.focus();
            }
        }.invokeInRunLoop();

        iframe.addEventListener( 'load', onload, false );

        return [
            NS.UA.isIOS ? null : this.get( 'toolbarView' ),
            el( 'div.editor', [ iframe ] )
        ];
    },

    expand: function () {
        if ( !NS.UA.isIOS && this.get( 'isExpanding' ) ) {
            var editor = this.get( 'editor' ),
                doc = editor && editor.getDocument(),
                body = doc && doc.body,
                lastChild = body && body.lastChild;

            if ( !lastChild ) {
                return;
            }

            var chromeHeight = this._chromeHeight || ( this._chromeHeight =
                    this.get( 'pxHeight' ) - body.offsetHeight ),
                height = lastChild.offsetTop + lastChild.offsetHeight +
                    chromeHeight + 30,
                layout = this.get( 'layout' );

            if ( layout.height !== height ) {
                layout = NS.clone( layout );
                layout.height = height;
                this.set( 'layout', layout );
            }
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
                .set( 'className', 'ToolbarView small RichTextToolbarView sticky' )
                .set( 'layout', {
                    top: scrollView.get( 'pxTop' ),
                    left: position.left - borders.left,
                    width: toolbarView.get( 'pxWidth' )
                });
            newParent.insertView( toolbarView );
        } else {
            toolbarView
                .set( 'className', 'ToolbarView small RichTextToolbarView' )
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
            'colour', 'bgcolour', '-',
            'image', '-',
            'link', '-',
            'ul', 'ol', '-',
            'quote', 'unquote', '-',
            'left', 'centre', 'right', 'justify', '-',
            'ltr', 'rtl'
        ],
        right: []
    },

    toolbarView: function () {
        var bind = NS.bind,
            richTextView = this;

        return new NS.ToolbarView({
            className: 'ToolbarView small RichTextToolbarView',
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
                isActive: bind( 'isBold', this ),
                label: NS.loc( 'Bold' ),
                tooltip: NS.loc( 'Bold' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-b' ),
                type: 'iconOnly',
                icon: 'icon-bold',
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
                tooltip: NS.loc( 'Italic' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-i' ),
                type: 'iconOnly',
                icon: 'icon-italic',
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
                tooltip: NS.loc( 'Underline' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-u' ),
                type: 'iconOnly',
                icon: 'icon-underline',
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
                isActive: bind( 'isStriked', this ),
                label: NS.loc( 'Strikethrough' ),
                tooltip: NS.loc( 'Strikethrough' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-shift-7' ),
                type: 'iconOnly',
                icon: 'icon-strikethrough',
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
                label: NS.loc( 'Font Size' ),
                tooltip: NS.loc( 'Font Size' ),
                type: 'iconOnly',
                icon: 'icon-font-size',
                target: this,
                method: 'showFontSizeMenu'
            }),
            font: new ButtonView({
                label: NS.loc( 'Font Face' ),
                tooltip: NS.loc( 'Font Face' ),
                type: 'iconOnly',
                icon: 'icon-font',
                target: this,
                method: 'showFontFaceMenu'
            }),
            colour: new ButtonView({
                label: NS.loc( 'Text Color' ),
                tooltip: NS.loc( 'Text Color' ),
                type: 'iconOnly',
                icon: 'icon-palette',
                target: this,
                method: 'showTextColourMenu'
            }),
            bgcolour: new ButtonView({
                label: NS.loc( 'Text Highlight' ),
                tooltip: NS.loc( 'Text Highlight' ),
                type: 'iconOnly',
                icon: 'icon-highlight',
                target: this,
                method: 'showTextHighlightColourMenu'
            }),
            link: new ButtonView({
                isActive: bind( 'isLink', this ),
                label: NS.loc( 'Link' ),
                tooltip: NS.loc( 'Link' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-k' ),
                type: 'iconOnly',
                icon: 'icon-link',
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
                acceptMultiple: true,
                acceptOnlyTypes: 'image/jpeg, image/png, image/gif',
                label: NS.loc( 'Insert Image' ),
                tooltip: NS.loc( 'Insert Image' ),
                type: 'iconOnly',
                icon: 'icon-image',
                target: this,
                method: 'insertImagesFromFiles'
            }),
            left: new ButtonView({
                isActive: bind( 'alignment', this, equalTo( 'left' ) ),
                label: NS.loc( 'Left' ),
                tooltip: NS.loc( 'Left' ),
                type: 'iconOnly',
                icon: 'icon-paragraph-left',
                activate: function () {
                    richTextView.setTextAlignment( 'left' );
                    this.fire( 'button:activate' );
                }
            }),
            centre: new ButtonView({
                isActive: bind( 'alignment', this, equalTo( 'center' ) ),
                label: NS.loc( 'Center' ),
                tooltip: NS.loc( 'Center' ),
                type: 'iconOnly',
                icon: 'icon-paragraph-centre',
                activate: function () {
                    richTextView.setTextAlignment( 'center' );
                    this.fire( 'button:activate' );
                }
            }),
            right: new ButtonView({
                isActive: bind( 'alignment', this, equalTo( 'right' ) ),
                label: NS.loc( 'Right' ),
                tooltip: NS.loc( 'Right' ),
                type: 'iconOnly',
                icon: 'icon-paragraph-right',
                activate: function () {
                    richTextView.setTextAlignment( 'right' );
                    this.fire( 'button:activate' );
                }
            }),
            justify: new ButtonView({
                isActive: bind( 'alignment', this, equalTo( 'justify' ) ),
                label: NS.loc( 'Justify' ),
                tooltip: NS.loc( 'Justify' ),
                type: 'iconOnly',
                icon: 'icon-paragraph-justify',
                activate: function () {
                    richTextView.setTextAlignment( 'justify' );
                    this.fire( 'button:activate' );
                }
            }),
            ltr: new ButtonView({
                isActive: bind( 'direction', this, equalTo( 'ltr' ) ),
                label: NS.loc( 'Text Direction: Left to Right' ),
                tooltip: NS.loc( 'Text Direction: Left to Right' ),
                type: 'iconOnly',
                icon: 'icon-lefttoright',
                activate: function () {
                    richTextView.setTextDirection( 'ltr' );
                    this.fire( 'button:activate' );
                }
            }),
            rtl: new ButtonView({
                isActive: bind( 'direction', this, equalTo( 'rtl' ) ),
                label: NS.loc( 'Text Direction: Right to Left' ),
                tooltip: NS.loc( 'Text Direction: Right to Left' ),
                type: 'iconOnly',
                icon: 'icon-righttoleft',
                activate: function () {
                    richTextView.setTextDirection( 'rtl' );
                    this.fire( 'button:activate' );
                }
            }),
            quote: new ButtonView({
                label: NS.loc( 'Quote' ),
                tooltip: NS.loc( 'Quote' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-]' ),
                type: 'iconOnly',
                icon: 'icon-quotes-left',
                target: richTextView,
                method: 'increaseQuoteLevel'
            }),
            unquote: new ButtonView({
                label: NS.loc( 'Unquote' ),
                tooltip: NS.loc( 'Unquote' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-[' ),
                type: 'iconOnly',
                icon: 'icon-quotes-right',
                target: richTextView,
                method: 'decreaseQuoteLevel'
            }),
            ul: new ButtonView({
                isActive: bind( 'isUnorderedList', this ),
                label: NS.loc( 'Unordered List' ),
                tooltip: NS.loc( 'Unordered List' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-shift-8' ),
                type: 'iconOnly',
                icon: 'icon-list',
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
                tooltip: NS.loc( 'Ordered List' ) + '\n' +
                    NS.formatKeyForPlatform( 'cmd-shift-9' ),
                type: 'iconOnly',
                icon: 'icon-numbered-list',
                activate: function () {
                    if ( richTextView.get( 'isOrderedList' ) ) {
                        richTextView.removeList();
                    } else {
                        richTextView.makeOrderedList();
                    }
                    this.fire( 'button:activate' );
                }
            })
        }).registerConfig( 'standard', this.get( 'toolbarConfig' ) );
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
            alignEdge: 'centre',
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
                [ 'Tahoma', 'tahoma, sans-serif' ],
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
            alignEdge: 'centre',
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
                .map( function ( colour ) {
                    colour = '#' + colour;
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
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    showTextHighlightColourMenu: function ( buttonView ) {
        this._colourText = false;
        popOver.show({
            view: this.get( 'textColourMenuView' ),
            alignWithView: buttonView,
            alignEdge: 'centre',
            showCallout: true,
            offsetTop: 2
        });
    },

    linkOverlayView: function () {
        var richTextView = this;
        return new NS.View({
            className: 'URLPopOver',
            value: '',
            draw: function ( layer, Element, el ) {
                return [
                    el( 'h3', [
                        NS.loc( 'Add a link to the following URL or email:' )
                    ]),
                    this._input = new NS.TextView({
                        value: NS.bindTwoWay( 'value', this ),
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
                            method: 'addLink'
                        })
                    ])
                ];
            },
            focus: function () {
                if ( this.get( 'isInDocument' ) ) {
                    this._input.set( 'selection', this.get( 'value' ).length )
                               .focus();
                    // IE8 and Safari 6 don't fire this event for some reason.
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
            editor.blur();
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
    strikethrough: execCommand( 'strikethrough' ),

    removeBold: execCommand( 'removeBold' ),
    removeItalic: execCommand( 'removeItalic' ),
    removeUnderline: execCommand( 'removeUnderline' ),
    removeStrikethrough: execCommand( 'removeStrikethrough' ),

    makeLink: execCommand( 'makeLink' ),
    removeLink: execCommand( 'removeLink' ),

    setFontFace: execCommand( 'setFontFace' ),
    setFontSize: execCommand( 'setFontSize' ),

    setTextColour: execCommand( 'setTextColour' ),
    setHighlightColour: execCommand( 'setHighlightColour' ),

    setTextAlignment: execCommand( 'setTextAlignment' ),
    setTextDirection: execCommand( 'setTextDirection' ),

    increaseQuoteLevel: execCommand( 'increaseQuoteLevel' ),
    decreaseQuoteLevel: execCommand( 'decreaseQuoteLevel' ),

    makeUnorderedList: execCommand( 'makeUnorderedList' ),
    makeOrderedList: execCommand( 'makeOrderedList' ),
    removeList: execCommand( 'removeList' ),

    increaseListLevel: execCommand( 'increaseListLevel' ),
    decreaseListLevel: execCommand( 'decreaseListLevel' ),

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
        switch ( NS.DOMEvent.lookupKey( event ) ) {
        case NS.UA.isMac ? 'meta-k' : 'ctrl-k':
            event.preventDefault();
            this.showLinkOverlay(
                this.get( 'toolbarView' ).getView( 'link' )
            );
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

    isBold: queryCommandState( 'B', ( />B\b/ ) ),
    isItalic: queryCommandState( 'I', ( />I\b/ ) ),
    isUnderlined: queryCommandState( 'U', ( />U\b/ ) ),
    isStriked: queryCommandState( 'S', ( />S\b/ ) ),
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

    direction: function () {
        var path = this.get( 'path' ),
            results = /\.dir\-(\w+)/.exec( path ),
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

    isUnorderedList: queryCommandState( 'UL', ( />UL\b/ ) ),
    isOrderedList: queryCommandState( 'OL', ( />OL\b/ ) ),

    // --- Keep state in sync with render ---

    handleEvent: function ( event ) {
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

RichTextView.isSupported = !!(
    ( 'contentEditable' in document.body ) &&
    ( !NS.UA.operaMobile ) &&
    ( !NS.UA.msie || NS.UA.msie > 8 ) &&
    ( !NS.UA.isIOS || NS.UA.version >= 8 )
);

NS.RichTextView = RichTextView;

}( this.O ) );
