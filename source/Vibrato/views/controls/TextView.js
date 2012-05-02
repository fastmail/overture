// -------------------------------------------------------------------------- \\
// File: TextView.js                                                          \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, AbstractControlView.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS, undefined ) {
    
var nativePlaceholder = 'placeholder' in document.createElement( 'input' );
    
var TextView = NS.Class({
    
    Extends: NS.AbstractControlView,
    
    Mixin: NS.Validate,
    
    init: function () {
        TextView.parent.init.apply( this, arguments );
        this.initValidate();
    },
    
    allowTextSelection: true,
    positioning: 'relative',
    layout: {},
    
    type: function () {
        return this.get( 'multiline' ) ?
            this.get( 'expanding' ) ? 'expanding' : 'multiline' : 'text';
    }.property(),
    maskEntry: false,
    multiline: false,
    expanding: false,
    highlight: false,
    placeholder: '',
    value: '',
    
    isFocussed: false,
    
    selection: function ( selection ) {
        var input = this._domControl;
        if ( selection !== undefined ) {
            var isNumber = ( typeof selection === 'number' ),
                start = isNumber ? selection : selection.start,
                end = isNumber ?
                    selection : ( selection.end || selection.start );
            // Firefox will throw an error if the input is not actually in the
            // document when trying to set the selection. There might be other
            // situations where it does so as well, so just using a try/catch to
            // guard against all.
            try {
                input.setSelectionRange( start, end );
            } catch ( e ) {}
        } else {
            return {
                start: input.selectionStart,
                end: input.selectionEnd
            };
        }
    }.property().nocache(),
    
    activate: function () {
        this.focus();
    },
    
    didAppendLayerToDocument: function () {
        // Restore scroll positions:
        if ( this.get( 'multiline' ) ) {
            var input = this._domControl,
                left = this.get( 'scrollLeft' ),
                top = this.get( 'scrollTop' );
            if ( left ) { input.scrollLeft = left; }
            if ( top ) { input.scrollTop = top; }
            input.addEventListener( 'scroll', this, false );
        }
        return TextView.parent.didAppendLayerToDocument.call( this );
    },
    willRemoveLayerFromDocument: function () {
        // Stop listening for scrolls:
        if ( this.get( 'multiline' ) ) {
            this._domControl.removeEventListener( 'scroll', this, false );
        }
        return TextView.parent.willRemoveLayerFromDocument.call( this );
    },
    
    // --- Render ---
    
    className: function () {
        return 'TextView ' + this.get( 'type' ) +
            ( this.get( 'highlight' ) ? ' highlight' : '' ) +
            ( this.get( 'isFocussed' ) ? ' focussed' : '' ) +
            ( this.get( 'isValid' ) ? '' : ' invalid' );
    }.property( 'type', 'highlight', 'isFocussed', 'isValid' ),
    
    _render: function ( layer ) {
        var el = NS.Element.create,
            value = this.get( 'value' ),
            input = this._domControl = el(
                this.get( 'multiline' ) ? 'textarea' : 'input', {
                    type: this.get( 'maskEntry' ) ? 'password' : 'text',
                    autocomplete: 'off',
                    disabled: this.get( 'disabled' ) ? 'disabled' : '',
                    tabindex: this.get( 'tabIndex' ),
                    value: value
                }),
            placeholder = this.get( 'placeholder' );
            
        if ( placeholder ) {
            if ( nativePlaceholder ) {
                input.placeholder = placeholder;
            } else {
                if ( !value ) {
                    input.className = 'placeholder';
                    input.value = placeholder;
                    this._placeholderShowing = true;
                }
            }
        }
        if ( this.get( 'expanding' ) ) {
            layer.appendChild( el( 'pre', [
                this._mirror = el( 'span', {
                    text: value
                }),
                el( 'br' )
            ]) );
        }
        layer.appendChild( input );
        layer.title = this.get( 'tooltip' );
    },
    
    // --- Keep state in sync with render ---
    
    _syncValue: function () {
        this._settingFromInput = true;
        this.set( 'value', this._domControl.value );
        this._settingFromInput = false;
    }.on( 'input' ),
    
    _onFocus: function () {
        if ( this._placeholderShowing ) {
            var input = this._domControl;
            input.className = '';
            input.value = '';
            this._placeholderShowing = false;
        }
        this.set( 'isFocussed', true );
    }.on( 'focus' ),
    
    _onBlur: function () {
        var value = this.get( 'value' );
        if ( !value && !nativePlaceholder ) {
            var placeholder = this.get( 'placeholder' );
            if ( placeholder ) {
                var input = this._domControl;
                input.className = 'placeholder';
                input.value = placeholder;
                this._placeholderShowing = true;
            }
        }
        this.set( 'isFocussed', false );
    }.on( 'blur' ),
    
    _onScroll: function ( event ) {
        var input = this._domControl,
            left = input.scrollLeft,
            top = input.scrollTop;
        
        this.beginPropertyChanges()
            .set( 'scrollLeft', left )
            .set( 'scrollTop', top )
        .endPropertyChanges();
        
        event.stopPropagation();
    }.on( 'scroll' ),
    
    _onKeypress: function ( event ) {
        // Stop event from getting to KB shortcuts handler.
        event.stopPropagation();
        var key = ( event.keyCode || event.which );
        // If key == enter, IE will automatically focus the nearest button
        // (presumably as though it were submitting the form). Stop this.
        if ( key === 13 && !this.get( 'multiline' ) ) {
            event.preventDefault();
        }
        // If key == esc, we want to blur. Not all browsers do this
        // automatically.
        if ( key === 27 ) {
            this.blur();
        }
    }.on( 'keypress' ),
    
    // --- Keep render in sync with state ---
    
    valueDidChange: function () {
        var value = this.get( 'value' );
        if ( !this._settingFromInput && this.get( 'isRendered' ) ) {
            this._domControl.value = value;
            // Ensure placeholder is updated.
            if ( !this.get( 'isFocussed' ) ) {
                this._onBlur();
            }
        }
        if ( this.get( 'expanding' ) ) {
            this._mirror.textContent = value;
        }
    }.observes( 'value' ),
    
    placeholderDidChange: function () {
        if ( this.get( 'isRendered' ) ) {
            var placeholder = this.get( 'placeholder' ),
                input = this._domControl;
            if ( nativePlaceholder ) {
                input.placeholder = placeholder;
            } else if ( this._placeholderShowing ) {
                input.value = placeholder;
            }
        }
    }.observes( 'placeholder' )
});

NS.TextView = TextView;

}( O ) );