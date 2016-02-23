// -------------------------------------------------------------------------- \\
// File: TextView.js                                                          \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, AbstractControlView.js              \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS, undefined ) {

var nativePlaceholder = 'placeholder' in document.createElement( 'input' );

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
        Property: O.TextView#inputAttributes
        Type: Object

        Extra attributes to add to the text view. Examples include:

        - maxLength: Number
        - autocomplete: 'on' or 'off'
        - autocapitalize: 'on' or 'off'
        - autocorrect: 'on' or 'off'
        - pattern: String (regexp)
    */
    inputAttributes: {
        autocomplete: 'off'
    },

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

        Will be added to the view's class name.
    */
    type: '',

    /**
        Property: O.TextView#className
        Type: String

        Overrides default in <O.View#className>. Will have the class `v-Text`,
        and any classes given in the <#type> property, along with the following
        other class names dependent on state:

        is-highlight - The <#isHighlighted> property is true.
        is-focussed  - The <#isFocussed> property is true.
        is-invalid   - The <#isValid> property is false.
        is-disabled  - The <#isDisabled> property is true.
    */
    className: function () {
        var type = this.get( 'type' );
        return 'v-Text' +
            ( this.get( 'isHighlighted' ) ? ' is-highlighted' : '' ) +
            ( this.get( 'isFocussed' ) ? ' is-focussed' : '' ) +
            ( this.get( 'isValid' ) ? '' : ' is-invalid' ) +
            ( this.get( 'isDisabled' ) ? ' is-disabled' : '' ) +
            ( type ? ' ' + type : '' );
    }.property( 'type', 'isHighlighted',
        'isFocussed', 'isValid', 'isDisabled' ),

    layerStyles: function () {
        return NS.extend({
            position: this.get( 'positioning' ),
            display: this.get( 'isMultiline' ) ? 'block' : 'inline-block',
            cursor: 'text',
            userSelect: 'text'
        }, this.get( 'layout' ) );
    }.property( 'layout', 'positioning' ),

    /**
        Method: O.TextView#draw

        Overridden to draw view. See <O.View#draw>.
    */
    draw: function ( layer, Element, el ) {
        var value = this.get( 'value' ),
            placeholder = this.get( 'placeholder' ),
            isMultiline = this.get( 'isMultiline' ),
            control = this._domControl = el(
                isMultiline ? 'textarea' : 'input', {
                    id: this.get( 'id' ) + '-input',
                    className: 'v-Text-input',
                    rows: isMultiline ? '1' : undefined,
                    name: this.get( 'name' ),
                    type: this.get( 'inputType' ),
                    disabled: this.get( 'isDisabled' ),
                    tabIndex: this.get( 'tabIndex' ),
                    value: value
                });

        this.redrawInputAttributes();

        if ( placeholder ) {
            if ( nativePlaceholder ) {
                control.placeholder = placeholder;
            } else if ( !value ) {
                this._placeholderShowing = true;
                NS.Element.addClass( control, 'v-Text-input--placeholder' );
                control.value = placeholder;
            }
        }

        layer.title = this.get( 'tooltip' );

        return [
            this._domLabel = el( 'span', [ this.get( 'label' ) ] ),
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
            this.propertyNeedsRedraw( self, 'textHeight', oldValue );
        }
    }.observes( 'value', 'placeholder', 'inputAttributes' ),

    /**
        Method: O.TextView#redrawValue

        Updates the content of the `<textarea>` or `<input>` to match the
        <#value> property.
    */
    redrawValue: function () {
        var value = this.get( 'value' );
        this._domControl.value = value;
        // Ensure placeholder is updated.
        if ( !nativePlaceholder && !this.get( 'isFocussed' ) ) {
            this._setPlaceholder();
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
        Method: O.TextView#redrawInputAttributes

        Updates any other properties of the `<input>` element.
    */
    redrawInputAttributes: function () {
        var inputAttributes = this.get( 'inputAttributes' ),
            control = this._domControl,
            property;
        for ( property in inputAttributes ) {
            control.set( property, inputAttributes[ property ] );
        }
    },

    redrawTextHeight: function () {
        var control = this._domControl,
            style = control.style,
            scrollView = this.getParent( NS.ScrollView ),
            scrollHeight;
        // Set to auto to collapse it back to one line, otherwise it would
        // never shrink if you delete text.
        style.height = 'auto';
        scrollHeight = control.scrollHeight;
        // Presto returns 0 immediately after appending to doc.
        if ( scrollHeight ) {
            style.height = scrollHeight + 'px';
        }
        // Collapsing the height will mess with the scroll, so make sure we
        // reset the scroll position back to what it was.
        if ( scrollView ) {
            scrollView.redrawScroll();
        }
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
        if ( this.get( 'isExpanding' ) ) {
            this.redrawTextHeight();
        }
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
            this.set( 'savedSelection', null );
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
    syncBackValue: function () {
        this._settingFromInput = true;
        if ( nativePlaceholder || !this._placeholderShowing ) {
            this.set( 'value', this._domControl.value );
        }
        this._settingFromInput = false;
    }.on( 'input' ),

    /**
        Method (private): O.TextView#_setPlaceholder

        Sets/removes the placholder text for browsers that don't support this
        natively.
    */
    _setPlaceholder: nativePlaceholder ? null :
    function ( _, __, ___, isFocussed ) {
        var control = this._domControl,
            placeholder;
        if ( isFocussed ) {
            if ( this._placeholderShowing ) {
                this._placeholderShowing = false;
                NS.Element.removeClass( control, 'v-Text-input--placeholder' );
                control.value = '';
            }
        } else {
            placeholder = this.get( 'placeholder' );
            if ( placeholder && !this.get( 'value' ) ) {
                this._placeholderShowing = true;
                NS.Element.addClass( control, 'v-Text-input--placeholder' );
                control.value = placeholder;
            }
        }
    }.observes( 'isFocussed' ),

    /**
        Method (private): O.TextView#_onClick

        Focus and set selection to the end.

        Parameters:
            event - {Event} The click event.
    */
    _onClick: function ( event ) {
        if ( event.target === this.get( 'layer' ) ) {
            this.set( 'selection', this.get( 'value' ).length )
                .focus();
        }
    }.on( 'click' ),

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

}( O ) );
