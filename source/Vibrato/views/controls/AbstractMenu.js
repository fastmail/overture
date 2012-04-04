// -------------------------------------------------------------------------- \\
// File: AbstractMenu.js                                                      \\
// Module: View                                                               \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

NS.AbstractMenu = {
    items: [],
    filterValue: '',
    filterItem: function ( item, pattern ) {},
    isItemHidden: function ( item ) { return false; },
    didBlurItem: function ( item ) {},
    didFocusItem: function ( item ) {},
    didSelectItem: function ( item ) {},
    getItemFromElement: function ( element ) { return null; },
    hide: function () {},

    // ---

    filterValueDidChange: function () {
        var value = this.get( 'filterValue' ).escapeRegExp(),
            pattern = new RegExp( '\\b' + value, 'i' ),
            items = this.get( 'items' ),
            l = items.get( 'length' );
        
        while ( l-- ) {
            this.filterItem( items.getObjectAt( l ), pattern );
        }
        if ( !this._am_focussed || this.isItemHidden( this._am_focussed ) ) {
            this.focusNext();
        }
    }.observes( 'filterValue' ),

    getAdjacentItem: function ( step ) {
        var items = this.get( 'items' ),
            l = items.get( 'length' ),
            i = ( ( items.indexOf( this._am_focussed ) + 1 ) ||
                  ( step > 0 ? l : 1 )
                ) - 1,
            current = i;
        do {
            i = ( i + step ).mod( l );
        } while ( this.isItemHidden( items.getObjectAt( i ) ) &&
            i !== current );
        return items.getObjectAt( i );
    },

    focusPrevious: function ( event ) {
        this.focusItem( this.getAdjacentItem( -1 ) );
        if ( event ) { event.preventDefault(); }
    },

    focusNext: function ( event ) {
        this.focusItem( this.getAdjacentItem( 1 ) );
        if ( event ) { event.preventDefault(); }
    },

    focusItem: function ( item ) {
        var current = this._am_focussed;
        if ( current === item ) { return; }
        if ( current ) {
            this.didBlurItem( current );
        }
        if ( !item || this.isItemHidden( item ) ) {
            this._am_focussed = null;
        } else {
            this.didFocusItem( this._am_focussed = item );
        }
    },

    selectFocussed: function ( event ) {
        var focussed = this._am_focussed;
        if ( focussed && !this.isItemHidden( focussed ) ) {
            // Invoke in next event loop, as otherwise the click event could be
            // triggered on whatever is below the menu (as it fires after it's
            // hidden), which can cause unexpected interactions.
            NS.RunLoop.invokeInNextEventLoop(
                this.didSelectItem.bind( this, focussed ) );
            if ( event ) { event.preventDefault(); }
        }
    },
    
    // Hide after event loop so that the keypress event is still routed to this
    // view. Otherwise it could activate a global keyboard shortcut.
    hideInNextEventLoop: function ( event ) {
        NS.RunLoop.invokeInNextEventLoop( this.hide, this );
        if ( event ) { event.preventDefault(); }
    },
    
    _keyBindings: {
        esc: 'hideInNextEventLoop',
        enter: 'selectFocussed',
        up: 'focusPrevious',
        down: 'focusNext'
    },
    
    _triggerKeyBinding: function ( event ) {
        var key = NS.DOMEvent.lookupKey( event ),
            bindings = this._keyBindings;
        if ( bindings[ key ] ) {
            this[ bindings[ key ] ]( event, key );
        }
    }.on( 'keydown' ),
    
    _focusOnHover: function ( event ) {
        var item = this.getItemFromElement( event.target );
        if ( item ) {
            this.focusItem( item );
        }
    }.on( 'mouseover' ),
    _defocusOnLeave: function () {
        this.focusItem( null );
    }.on( 'mouseout' ),
    
    _selectClicked: function ( event ) {
        if ( NS.Element.contains( this.get( 'layer' ), event.target ) ) {
            var item = this.getItemFromElement( event.target );
            if ( item ) {
                this.focusItem( item );
                this.selectFocussed( event );
            }
        }
    }.on( 'mousedown' )
};

}( O ) );