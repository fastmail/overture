// -------------------------------------------------------------------------- \\
// File: TextView.js                                                          \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, Validate, AbstractControlView.js          \\
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
            // Ensure any value changes have been drawn.
            this.redraw();
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

    blurOnEscape: true,

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
            ( this.get( 'isValid' ) ? '' : ' invalid' ) +
            ( this.get( 'isDisabled' ) ? ' disabled' : '' );
    }.property( 'type', 'isHighlighted',
        'isFocussed', 'isValid', 'isDisabled' ),

    draw: function ( layer ) {
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
                    text: NS.bind( 'value', this )
                }),
                el( 'br' )
            ]) : null,
            control
        ]);
    },

    // --- Keep render in sync with state ---

    propertyNeedsRedraw: function ( _, property ) {
        if ( property !== 'value' || !this._settingFromInput ) {
            TextView.parent.propertyNeedsRedraw.apply( this, arguments );
        }
    }.observes( 'className', 'layerStyles',
        'isDisabled', 'label', 'tooltip',
        'value', 'placeholder' ),

    redrawValue: function () {
        var value = this.get( 'value' );
        this._domControl.value = value;
        // Ensure placeholder is updated.
        if ( !this.get( 'isFocussed' ) ) {
            this._onBlur();
        }
    },

    redrawPlaceholder: function () {
        var placeholder = this.get( 'placeholder' ),
            control = this._domControl;
        if ( nativePlaceholder ) {
            control.placeholder = placeholder;
        } else if ( this._placeholderShowing ) {
            control.value = placeholder;
        }
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

    syncBackValue: function ( event ) {
        if ( !event || this.get( 'isFocussed' ) ) {
            this._settingFromInput = true;
            this.set( 'value', this._domControl.value );
            this._settingFromInput = false;
        }
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
    }.on( 'keypress' ),

    _blurOnEsc: function ( event ) {
        var key = ( event.keyCode || event.which );
        // If key == esc, we want to blur. Not all browsers do this
        // automatically.
        if ( key === 27 && this.get( 'blurOnEscape' ) ) {
            this.blur();
        }
    }.on( 'keydown' )
});

if ( 8 <= NS.UA.msie && NS.UA.msie <= 9 ) {
    TextView.implement({
        _ieSyncBackValue: function ( event ) {
            var key = NS.DOMEvent.lookupKey( event );
            // IE9 fails to fire the input event on deletion of content.
            // IE8 fails to fire the propertychange event on deletion
            // and also if only a single character input (at least after a
            // deletion)
            if ( NS.UA.msie === 8 || key === 'backspace' || key === 'delete' ) {
                this.fire( 'input' );
            }
        }.on( 'keyup' )
    });
}

NS.TextView = TextView;

}( this.O ) );
