// -------------------------------------------------------------------------- \\
// File: MenuView.js                                                          \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js, AbstractMenu.js                  \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

var MenuView = NS.Class({
    
    Extends: NS.View,
    
    Mixin: NS.AbstractMenu,
    
    init: function ( options ) {
        MenuView.parent.init.call( this, options );
        var items = this.get( 'items' ),
            shortcuts = this._shortcuts = {},
            keyBindings = this._keyBindings =
                Object.create( this._keyBindings );
        
        items.forEach( function ( item ) {
            var shortcut = item.shortcut;
            if ( shortcut ) {
                shortcuts[ shortcut ] = item;
                keyBindings[ shortcut ] = 'onShortcut';
            }
        });
    },
    
    className: 'MenuView',
    positioning: 'relative',
    layout: {},
    
    showFilter: false,
    
    didCreateLayer: function ( layer ) {
        MenuView.parent.didCreateLayer.call( this, layer );
        layer.addEventListener( 'mouseover', this, false );
        layer.addEventListener( 'mouseout', this, false );
    },
    
    willDestroyLayer: function ( layer ) {
        layer.removeEventListener( 'mouseout', this, false );
        layer.removeEventListener( 'mouseover', this, false );
        MenuView.parent.willDestroyLayer.call( this, layer );
    },
    
    didAppendLayerToDocument: function () {
        MenuView.parent.didAppendLayerToDocument.call( this );
        if ( this.get( 'showFilter' ) ) {
            this.focusItem( this.get( 'items' )[0] );
            this._input.focus();
        }
        return this;
    },
    
    didRemoveLayerFromDocument: function () {
        this.focusItem( null );
        return MenuView.parent.didRemoveLayerFromDocument.call( this );
    },
    
    _render: function ( layer ) {
        var Element = NS.Element,
            el = Element.create;
        
        Element.appendChildren( layer, [
            this.get( 'showFilter' ) ? el( 'div', [
                this._input = el( 'input', {
                    type: 'text'
                })
            ]) : null,
            el( 'ul', this.get( 'items' ).map( function ( item, index ) {
                var li = item.li = el( 'li', {
                    className: item.className,
                    style: item.style
                }, [
                    el( 'span', {
                        className: 'label' +
                            ( item.shortcut ? ' hasShortcut' : '' ),
                        text: item.label
                    }),
                    item.shortcut ? el( 'span.shortcut', {
                        text: item.shortcut
                    }) : null
                ]);
                li._index = index;
                return li;
            }) )
        ]);
    },
    
    // --- AbstractMenu support ---
    
    filterItem: function ( item, pattern ) {
        var Element = NS.Element,
            addClass = Element.addClass,
            removeClass = Element.removeClass;
        if ( pattern.test( item.label ) ) {
            if ( item.isHidden ) {
                removeClass( item.li, 'hidden' );
                item.isHidden = false;
            }
        } else {
            if ( !item.isHidden ) {
                addClass( item.li, 'hidden' );
                item.isHidden = true;
            }
        }
    },
    isItemHidden: function ( item ) {
        return item.isHidden;
    },
    didBlurItem: function ( item ) {
        NS.Element.removeClass( item.li, 'isFocussed' );
    },
    didFocusItem: function ( item ) {
        NS.Element.addClass( item.li, 'isFocussed' );
    },
    didSelectItem: function ( item ) {
        item.onSelect();
        this.hideInNextEventLoop();
    },
    getItemFromElement: function ( el ) {
        var layer = this.get( 'layer' );
        while ( el.nodeName !== 'LI' &&
            ( el = el.parentNode ) && el !== layer ) {/* Empty */}
        return ( el && el !== layer ) ? this.get( 'items' )[ el._index ] : null;
    },
    
    hide: function () {
        var parent = this.get( 'parentView' );
        if ( parent ) { parent.hide(); }
    },
    
    // --- End AbstractMenu support ---
    
    _keyBindings: {
        esc: 'onEscape',
        enter: 'selectFocussed',
        up: 'focusPrevious',
        down: 'focusNext'
    },
    
    onEscape: function ( event ) {
        var input = this._input;
        if ( input && input.value ) {
            // Firefox refuses to erase the value if you do it in the same event
            // loop; it puts it back in just before keyup. Bizarre.
            NS.RunLoop.invokeInNextEventLoop( function () {
                input.value = '';
                input.focus();
                this._syncFilterValue();
            }, this );
        }
        else {
            this.hideInNextEventLoop();
        }
        if ( event ) { event.preventDefault(); }
    },
    
    onShortcut: function ( event, key ) {
        this._shortcuts[ key ].onSelect();
        this.hideInNextEventLoop( event );
    },
    
    _syncFilterValue: function () {
        if ( this._input ) {
            this.set( 'filterValue', this._input.value );
        }
    }.on( 'input' )
});

NS.MenuView = MenuView;

}( O ) );