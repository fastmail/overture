// -------------------------------------------------------------------------- \\
// File: TextView.js                                                          \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, AbstractControlView.js              \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS, undefined ) {

var isOperaMini = !!NS.UA.operaMini;
var nativePlaceholder = !isOperaMini &&
        'placeholder' in document.createElement( 'input' );

/**
    Class: O.TextView

    Extends: O.AbstractControlView

    A text input control. The `value` property is two-way bindable, representing
    the input text.
*/
var TextView = NS.Class({

    Extends: NS.AbstractControlView,

    init: function ( mixin ) {
        TextView.parent.init.call( this, mixin );
        this._settingFromInput = false;
    },

    /**
        Property: O.TextView#isMultiline
        Type: Boolean
        Default: false

        If set to true, the text field will accept line breaks.

        This property *must not* be changed after the view has been rendered.
    */
    isMultiline: false,

    /**
        Property: O.TextView#isExpanding
        Type: Boolean
        Default: false

        If <#isMultiline> is set to true, setting <#isExpanding> to true will
        make it automatically expand vertically to fit its contents, rather than
        show a scrollbar.

        This property *must not* be changed after the view has been rendered.
    */
    isExpanding: false,

    /**
        Property: O.TextView#isValid
        Type: Boolean
        Default: true

        If false, an `invalid' class will be added to the view's class name.
    */
    isValid: true,

    /**
        Property: O.TextView#isHighlighted
        Type: Boolean
        Default: false

        If true, a `highlight` class will be added to the view's class name.
        This is a styling hook for highlighting the view, e.g. if it fails
        validation.
    */
    isHighlighted: false,

    /**
        Property: O.TextView#isFocussed
        Type: Boolean

        Represents whether the view currently has focus or not.
    */
    isFocussed: false,

    /**
        Property: O.TextView#maxLength
        Type: Number|undefined
        Default: undefined

        If set to a number, this will be the maximum number of characters
        allowed in the text input. If undefined, no limit will be placed
        (default).
    */
    maxLength: undefined,

    /**
        Property: O.TextView#inputType
        Type: String
        Default: "text"

        The type property for the <input> DOM node (e.g. "password", "tel" etc.)

        This property *must not* be changed after the view has been rendered.
    */
    inputType: 'text',

    /**
        Property: O.TextView#placeholder
        Type: String
        Default: ''

        Placeholder text to be displayed in the text input when it is empty.
    */
    placeholder: '',

    /**
        Property: O.TextView#value
        Type: String
        Default: ''

        The value currently input in the text field.
    */
    value: '',

    /**
        Property: O.TextView#selection
        Type: Object

        When used as a getter, this will return an object with two properties:

        start - {Number} The number of characters offset from the beginning of
                the text that the selection starts.
        end   - {Number} The number of characters offset from the beginning of
                the text that the selection ends.

        Note, if there is no selection, the start and end values will be the
        same, and give the position of the cursor.

        When used as a setter, you can give it an object as described above to
        set the selection, or if you just want to give it a cursor position, you
        can pass a number instead.

        Note, this property is *not observable* and cannot be used to monitor
        changes in selection/cursor position.

    */
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

    /**
        Property: O.TextView#blurOnEscape
        Type: Boolean
        Default: true

        If true, if the user is focussed in the text view and hits the escape
        key, the focus will be removed.
    */
    blurOnEscape: true,

    // --- Render ---

    /**
        Property: O.TextView#allowTextSelection
        Type: Boolean
        Default: true

        Overrides default in <O.View#allowTextSelection>.
    */
    allowTextSelection: true,

    /**
        Property: O.TextView#type
        Type: String

        The type of the text view, as determined by the <#isMultiline> and
        <#isExpanding> properties. Will be one of `'expanding'`, `'multiline'`
        or `'text'`. Will be added to the view's class name.
    */
    type: function () {
        return this.get( 'isMultiline' ) ?
            this.get( 'isExpanding' ) ? 'expanding' : 'multiline' : 'text';
    }.property(),

    /**
        Property: O.TextView#className
        Type: String

        Overrides default in <O.View#className>. Will have the class `TextView`,
        and the class given in the <#type> property, along with the following
        other class names dependent on state:

        highlight - The <#isHighlighted> property is true.
        focussed  - The <#isFocussed> property is true.
        invalid   - The <#isValid> property is false.
        disabled  - The <#isDisabled> property is true.
    */
    className: function () {
        return 'TextView ' + this.get( 'type' ) +
            ( this.get( 'isHighlighted' ) ? ' highlight' : '' ) +
            ( this.get( 'isFocussed' ) ? ' focussed' : '' ) +
            ( this.get( 'isValid' ) ? '' : ' invalid' ) +
            ( this.get( 'isDisabled' ) ? ' disabled' : '' );
    }.property( 'type', 'isHighlighted',
        'isFocussed', 'isValid', 'isDisabled' ),

    /**
        Method: O.TextView#draw

        Overridden to draw view. See <O.View#draw>.
    */
    draw: function ( layer, Element, el ) {
        var value = this.get( 'value' ),
            placeholder = this.get( 'placeholder' ),
            control = this._domControl = el(
                this.get( 'isMultiline' ) ? 'textarea' : 'input', {
                    id: this.get( 'id' ) + '-input',
                    name: this.get( 'name' ),
                    type: this.get( 'inputType' ),
                    autocomplete: 'off',
                    disabled: this.get( 'isDisabled' ),
                    tabIndex: this.get( 'tabIndex' ),
                    maxLength: this.get( 'maxLength' ),
                    value: value
                });

        // Need to add explicit handlers, or Opera Mini won't fire the events
        if ( isOperaMini ) {
            control.onfocus = function () {};
            control.onblur = function () {};
        }

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

        return [
            this._domLabel = el( 'span', [ this.get( 'label' ) ] ),
            this.get( 'isExpanding' ) ? el( 'pre', [
                this._mirror = el( 'span', {
                    text: NS.bind( 'value', this )
                }),
                el( 'br' )
            ]) : null,
            control
        ];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.TextView#textNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    textNeedsRedraw: function ( self, property, oldValue ) {
        var isValue = ( property === 'value' );
        if ( !isValue || !this._settingFromInput ) {
            this.propertyNeedsRedraw( self, property, oldValue );
        }
        if ( isValue && this.get( 'isExpanding' ) ) {
            NS.RunLoop.queueFn( 'after', this.parentViewDidResize, this );
        }
    }.observes( 'value', 'placeholder', 'maxLength' ),

    /**
        Method: O.TextView#redrawValue

        Updates the content of the `<textarea>` or `<input>` to match the
        <#value> property.
    */
    redrawValue: function () {
        var value = this.get( 'value' );
        this._domControl.value = value;
        // Ensure placeholder is updated.
        if ( !this.get( 'isFocussed' ) ) {
            this._onBlur();
        }
    },

    /**
        Method: O.TextView#redrawPlaceholder

        Updates the placeholder text in the DOM when the <#placeholder> property
        changes.
    */
    redrawPlaceholder: function () {
        var placeholder = this.get( 'placeholder' ),
            control = this._domControl;
        if ( nativePlaceholder ) {
            control.placeholder = placeholder;
        } else if ( this._placeholderShowing ) {
            control.value = placeholder;
        }
    },

    /**
        Method: O.TextView#redrawMaxLength

        Updates the maxLength property of the `<textarea>` or `<input>` to match
        the <#maxLength> property.
    */
    redrawMaxLength: function () {
        this._domControl.maxLength = this.get( 'maxLength' );
    },

    // --- Activate ---

    /**
        Method: O.TextView#activate

        Overridden to focus the text view. See <O.AbstractControlView#activate>.
    */
    activate: function () {
        this.focus();
    },

    // --- Scrolling and focus ---

    savedSelection: null,

    /**
        Method: O.TextView#didEnterDocument

        Overridden to restore scroll position and selection. See
        <O.View#didEnterDocument>.
    */
    didEnterDocument: function () {
        TextView.parent.didEnterDocument.call( this );
        // Restore scroll positions:
        if ( this.get( 'isMultiline' ) ) {
            var control = this._domControl,
                left = this.get( 'scrollLeft' ),
                top = this.get( 'scrollTop' );
            if ( left ) { control.scrollLeft = left; }
            if ( top ) { control.scrollTop = top; }
            control.addEventListener( 'scroll', this, false );
        }
        var selection = this.get( 'savedSelection' );
        if ( selection ) {
            this.set( 'selection', selection ).focus();
        }
        return this;
    },

    /**
        Method: O.TextView#willLeaveDocument

        Overridden to save scroll position and selection. See
        <O.View#willLeaveDocument>.
    */
    willLeaveDocument: function () {
        // If focussed, save cursor position
        if ( this.get( 'isFocussed' ) ) {
            this.set( 'savedSelection', this.get( 'selection' ) );
            this.blur();
        }
        // Stop listening for scrolls:
        if ( this.get( 'isMultiline' ) ) {
            this._domControl.removeEventListener( 'scroll', this, false );
        }
        return TextView.parent.willLeaveDocument.call( this );
    },

    /**
        Method (private): O.TextView#_syncBackScrolls

        Sets the <O.View#scrollLeft> and <O.View#scrollTop> properties whenever
        the user scrolls the textarea.

        Parameters:
            event - {Event} The scroll event.
    */
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

    /**
        Method: O.TextView#syncBackValue

        Updates the <#value> property when the user interacts with the textarea.

        Parameters:
            event - {Event} The input event.
    */
    syncBackValue: function ( event ) {
        if ( !event || this.get( 'isFocussed' ) ) {
            this._settingFromInput = true;
            this.set( 'value', this._domControl.value );
            this._settingFromInput = false;
        }
    }.on( isOperaMini ? 'change' : 'input' ),

    /**
        Method (private): O.TextView#_onFocus

        Updates the <#isFocussed> property and removes the placholder text for
        browsers that don't support this natively.

        Parameters:
            event - {Event} The focus event.
    */
    _onFocus: function () {
        if ( this._placeholderShowing ) {
            var control = this._domControl;
            control.className = '';
            control.value = '';
            this._placeholderShowing = false;
        }
        this.set( 'isFocussed', true );
    }.on( 'focus' ),

    /**
        Method (private): O.TextView#_onBlur

        Updates the <#isFocussed> property and adds the placholder text for
        browsers that don't support this natively.

        Parameters:
            event - {Event} The blur event.
    */
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

    /**
        Method (private): O.TextView#_onKeypress

        Stop IE automatically focussing the nearest button when the user hits
        enter in single line text inputs.

        Parameters:
            event - {Event} The keypress event.
    */
    _onKeypress: function ( event ) {
        var key = ( event.keyCode || event.which );
        // If key == enter, IE will automatically focus the nearest button
        // (presumably as though it were submitting the form). Stop this.
        if ( key === 13 && !this.get( 'isMultiline' ) ) {
            event.preventDefault();
        }
    }.on( 'keypress' ),

    /**
        Method (private): O.TextView#_blurOnEsc

        Blur the text area when the user hits escape, provided the
        <#blurOnEscape> property is set to `true`.

        Parameters:
            event - {Event} The keydown event.
    */
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
            var key = event.type === 'cut' ?
                'delete' : NS.DOMEvent.lookupKey( event );
            // IE9 fails to fire the input event on deletion of content.
            // IE8 fails to fire the propertychange event on deletion
            // and also if only a single character input (at least after a
            // deletion)
            if ( NS.UA.msie === 8 || key === 'backspace' || key === 'delete' ) {
                this.fire( 'input' );
            }
        }.on( 'keyup', 'cut' )
    });
}

NS.TextView = TextView;

}( this.O ) );
