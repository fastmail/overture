// -------------------------------------------------------------------------- \\
// File: AutoCompleteView.js                                                  \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var AutoCompleteSource = NS.Class({
    
    Extends: NS.Object,
    
    maxResults: 10,
    suggestions: [],
    
    getTestFn: function ( value ) {
        var regexp = new RegExp( '\\b' + value.escapeRegExp(), 'i' );
        return regexp.test.bind( regexp );
    },
    renderSuggestion: function ( suggestion, searchTerm ) {
        return suggestion.escapeHTML();
    },
    acceptSuggestion: function ( suggestion, current ) {
        return suggestion;
    }
});

var AutoCompleteView = NS.Class({
    
    Extends: NS.View,
    
    Mixin: NS.AbstractMenu,
    
    positioning: 'absolute',
    className: 'AutoCompleteView',
    
    minChars: 1,
    sources: [],
        
    // ---
    
    init: function ( options ) {
        AutoCompleteView.parent.init.call( this, options );
        var view = this.get( 'inputView' ),
            _;
        if ( view ) {
            this.inputViewDidChange( _, _, _, view );
        }
    },
    
    didCreateLayer: function ( layer ) {
        AutoCompleteView.parent.didCreateLayer.call( this, layer );
        layer.addEventListener( 'mouseover', this, false );
        layer.addEventListener( 'mouseout', this, false );
    },
    
    willDestroyLayer: function ( layer ) {
        layer.removeEventListener( 'mouseout', this, false );
        layer.removeEventListener( 'mouseover', this, false );
        AutoCompleteView.parent.willDestroyLayer.call( this, layer );
    },
    
    inputView: null,
    inputViewDidChange: function ( _, __, oldView, newView ) {
        if ( oldView ) {
            oldView.detach( 'focus', this, 'inputDidReceiveFocus' );
            oldView.detach( 'blur', this, 'inputDidLoseFocus' );
            oldView.detach( 'keydown', this, 'inputDidKeydown' );
        }
        if ( newView ) {
            newView.on( 'focus', this, 'inputDidReceiveFocus' );
            newView.on( 'blur', this, 'inputDidLoseFocus' );
            newView.on( 'keydown', this, 'inputDidKeydown' );
            if ( newView.get( 'isFocussed' ) ) {
                this.inputDidReceiveFocus();
            }
        }
    }.observes( 'inputView' ),

    inputDidReceiveFocus: function () {
        this._isActive = true;
        if ( this.get( 'filterValue' ).length >= this.get( 'minChars' ) ) {
            this.showSuggestions();
        }
    },
    
    inputDidLoseFocus: function () {
        this._isActive = false;
        this.hideSuggestions();
    },
    
    // Fire keydown event to trigger AbstractMenu key bindings.
    // However, also be sure to stop propagation as otherwise if the
    // autocomplete view is actually a child of the input view you get an
    // infinite loop!
    inputDidKeydown: function ( event ) {
        if ( this._isShowing ) {
            this.fire( 'keydown', event );
        }
    },
    stopPropagation: function ( event ) {
        event.stopPropagation();
    }.on( 'keydown' ),
    
    filterValue: NS.bind( 'inputView.value' ),
    filterValueDidChange: function ( _, __, ___, value ) {
        if ( this._isActive ) {
            if ( value.length >= this.get( 'minChars' ) ) {
                this.showSuggestions();
            } else {
                this.hideSuggestions();
            }
        }
    }.observes( 'filterValue' ),
    
    acceptSuggestion: function ( event ) {
        this._selectClicked( event );
    }.on( 'mousedown' ),
    
    // ---
    
    _keyBindings: {
        up: 'focusPrevious',
        down: 'focusNext',
        tab: 'selectFocussed',
        enter: 'selectFocussed'
    },
    
    // filterItem: function ( item, pattern ) {},
    // isItemHidden: function ( item ) { return false; },
    didBlurItem: function ( item ) {
        NS.Element.removeClass( item.element, 'focussed' );
    },
    didFocusItem: function ( item ) {
        NS.Element.addClass( item.element, 'focussed' );
    },
    didSelectItem: function ( item ) {
        var inputView = this.get( 'inputView' ),
            current = inputView.get( 'value' ),
            result = item.source.acceptSuggestion( item.suggestion, current );
        
        if ( result !== current ) {
            inputView
                .set( 'value', result )
                .set( 'selection', { start: result.length } );
        }
    },
    getItemFromElement: function ( el ) {
        var layer = this.get( 'layer' );
        while ( el.nodeName !== 'LI' &&
            ( el = el.parentNode ) && el !== layer ) {/* Empty */}
        return ( el && el !== layer ) ? this.get( 'items' )[ el._index ] : null;
    },
    // hide: function () {},
    
    // ---
    
    showSuggestions: function () {
        var value = this.get( 'filterValue' );
        
        if ( this._lastFilterValue !== value ) {
            var sources = this.get( 'sources' ),
                items = [],
                itemsLength = 0,
                layer = this.get( 'layer' ),
                el = NS.Element.create,
                ul = el( 'ul' ),
                i, l, source, count, max, suggestions, accept,
                j, m, suggestion, element;
            
            for ( i = 0, l = sources.length; i < l; i += 1 ) {
                source = sources[i];
                count = 0;
                max = source.get( 'maxResults' );
                suggestions = source.get( 'suggestions' );
                accept = source.getTestFn( value );
                
                for ( j = 0, m = suggestions.get( 'length' );
                        j < m && count < max; j += 1 ) {
                    if ( accept( suggestion = suggestions.getObjectAt( j ) ) ) {
                        element = el( 'li', {
                            html: source.renderSuggestion( suggestion, value )
                        });
                        element._index = itemsLength;
                        ul.appendChild( element );
                        items.push({
                            source: source,
                            suggestion: suggestion,
                            element: element
                        });
                        count += 1;
                        itemsLength += 1;
                    }
                }
            }
            
            if ( this._ul ) {
                layer.replaceChild( ul, this._ul );
            } else {
                layer.appendChild( ul );
            }
            
            this._ul = ul;
            this._lastFilterValue = value;
            
            this.set( 'items', items );
            
            this.focusItem( items[0] );
        }
        
        if ( !this.get( 'items' ).length ) {
            this.hideSuggestions();
        } else if ( !this._isShowing ) {
            // Focus the first item
            this.focusItem( this.get( 'items' )[0] );
            this.get( 'layer' ).style.display = 'block';
            this._isShowing = true;
        }
    },
    
    hideSuggestions: function () {
        this.get( 'layer' ).style.display = 'none';
        this.focusItem( null );
        this._isShowing = false;
    }
});

NS.AutoCompleteSource = AutoCompleteSource;
NS.AutoCompleteView = AutoCompleteView;

}( this.O ) );