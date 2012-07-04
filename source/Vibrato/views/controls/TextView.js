// -------------------------------------------------------------------------- \\
// File: TextView.js                                                          \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, AbstractControlView.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS, undefined ) {

var nativePlaceholder = 'placeholder' in document.createElement( 'input' );

var TextView = NS.Class({

    Extends: NS.AbstractControlView,

    Mixin: NS.Validate,

    init: function () {
        TextView.parent.init.apply( this, arguments );
        this._settingFromInput = false;
        this.initValidate();
    },

    isMasked: false,
    isMultiline: false,
    isExpanding: false,
    isHighlighted: false,
    isFocussed: false,

    placeholder: '',
    value: '',

    selection: function ( selection ) {
        var control = this._domControl,
            isNumber = ( typeof selection === 'number' ),
            start = selection ? isNumber ?
                    selection : selection.start : 0,
            end = selection ? isNumber ?
                    selection : selection.end || start : start;
        if ( selection !== undefined ) {
            // Firefox will throw an error if the control is not actually in the
            // document when trying to set the selection. There might be other
            // situations where it does so as well, so just using a try/catch to
            // guard against all.
            try {
                control.setSelectionRange( start, end );
            } catch ( error ) {}
        } else {
            // Firefox sometimes throws an error if you try to read the
            // selection. Again, probably if the control is not actually in the
            // document.
            try {
                start = control.selectionStart;
                end = control.selectionEnd;
            } catch ( error ) {}
        }
        return selection || {
            start: start,
            end: end
        };
    }.property().nocache(),

    // --- Render ---

    allowTextSelection: true,

    type: function () {
        return this.get( 'isMultiline' ) ?
            this.get( 'isExpanding' ) ? 'expanding' : 'multiline' : 'text';
    }.property(),

    className: function () {
        return 'TextView ' + this.get( 'type' ) +
            ( this.get( 'isHighlighted' ) ? ' highlight' : '' ) +
            ( this.get( 'isFocussed' ) ? ' focussed' : '' ) +
            ( this.get( 'isValid' ) ? '' : ' invalid' );
    }.property( 'type', 'isHighlighted', 'isFocussed', 'isValid' ),

    _render: function ( layer ) {
        var Element = NS.Element,
            el = NS.Element.create,
            value = this.get( 'value' ),
            placeholder = this.get( 'placeholder' ),
            control = this._domControl = el(
                this.get( 'isMultiline' ) ? 'textarea' : 'input', {
                    type: this.get( 'isMasked' ) ? 'password' : 'text',
                    autocomplete: 'off',
                    disabled: this.get( 'isDisabled' ),
                    tabIndex: this.get( 'tabIndex' ),
                    value: value
                });

        if ( placeholder ) {
            if ( nativePlaceholder ) {
                control.placeholder = placeholder;
            } else if ( !value ) {
                control.className = 'placeholder';
                control.value = placeholder;
                this._placeholderShowing = true;
            }
        }

        layer.title = this.get( 'tooltip' );
        Element.appendChildren( layer, [
            this._domLabel = el( 'span', [ this.get( 'label' ) ] ),
            this.get( 'isExpanding' ) ? el( 'pre', [
                this._mirror = el( 'span', {
                    text: value
                }),
                el( 'br' )
            ]) : null,
            control
        ]);
    },

    // --- Activate ---

    activate: function () {
        this.focus();
    },

    // --- Scrolling ---

    didAppendLayerToDocument: function () {
        // Restore scroll positions:
        if ( this.get( 'isMultiline' ) ) {
            var control = this._domControl,
                left = this.get( 'scrollLeft' ),
                top = this.get( 'scrollTop' );
            if ( left ) { control.scrollLeft = left; }
            if ( top ) { control.scrollTop = top; }
            control.addEventListener( 'scroll', this, false );
        }
        return TextView.parent.didAppendLayerToDocument.call( this );
    },
    willRemoveLayerFromDocument: function () {
        // Stop listening for scrolls:
        if ( this.get( 'isMultiline' ) ) {
            this._domControl.removeEventListener( 'scroll', this, false );
        }
        return TextView.parent.willRemoveLayerFromDocument.call( this );
    },

    _syncBackScrolls: function ( event ) {
        var control = this._domControl,
            left = control.scrollLeft,
            top = control.scrollTop;

        this.beginPropertyChanges()
            .set( 'scrollLeft', left )
            .set( 'scrollTop', top )
        .endPropertyChanges();

        event.stopPropagation();
    }.on( 'scroll' ),

    // --- Keep state in sync with render ---

    syncBackValue: function () {
        this._settingFromInput = true;
        if ( this.get( 'isFocussed' ) ) {
            this.set( 'value', this._domControl.value );
        }
        this._settingFromInput = false;
    }.on( 'input' ),

    _onFocus: function () {
        if ( this._placeholderShowing ) {
            var control = this._domControl;
            control.className = '';
            control.value = '';
            this._placeholderShowing = false;
        }
        this.set( 'isFocussed', true );
    }.on( 'focus' ),

    _onBlur: function () {
        this.set( 'isFocussed', false );
        if ( !nativePlaceholder ) {
            var placeholder = this.get( 'placeholder' );
            if ( placeholder && !this.get( 'value' ) ) {
                var control = this._domControl;
                control.className = 'placeholder';
                control.value = placeholder;
                this._placeholderShowing = true;
            }
        }
    }.on( 'blur' ),

    _onKeypress: function ( event ) {
        // Stop event from getting to KB shortcuts handler.
        event.stopPropagation();
        var key = ( event.keyCode || event.which );
        // If key == enter, IE will automatically focus the nearest button
        // (presumably as though it were submitting the form). Stop this.
        if ( key === 13 && !this.get( 'isMultiline' ) ) {
            event.preventDefault();
        }
        // If key == esc, we want to blur. Not all browsers do this
        // automatically.
        if ( key === 27 ) {
            this.blur();
        }
    }.on( 'keypress' ),

    // --- Keep render in sync with state ---

    syncValue: function () {
        var value = this.get( 'value' );
        if ( !this._settingFromInput && this.get( 'isRendered' ) ) {
            this._domControl.value = value;
            // Ensure placeholder is updated.
            if ( !this.get( 'isFocussed' ) ) {
                this._onBlur();
            }
        }
        if ( this.get( 'isExpanding' ) ) {
            this._mirror.textContent = value;
        }
    }.observes( 'value' ),

    syncPlaceholder: function () {
        if ( this.get( 'isRendered' ) ) {
            var placeholder = this.get( 'placeholder' ),
                control = this._domControl;
            if ( nativePlaceholder ) {
                control.placeholder = placeholder;
            } else if ( this._placeholderShowing ) {
                control.value = placeholder;
            }
        }
    }.observes( 'placeholder' )
});

NS.TextView = TextView;

}( this.O ) );
