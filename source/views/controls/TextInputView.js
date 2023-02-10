/*global document, getComputedStyle */

import { Class, meta } from '../../core/Core.js';
import { lookupKey } from '../../dom/DOMEvent.js';
import { create as el, nearest } from '../../dom/Element.js';
import { browser } from '../../ua/UA.js';
import { ScrollView } from '../containers/ScrollView.js';
import { AbstractInputView } from './AbstractInputView.js';

/* { property, nocache, on, observes } from */
import '../../foundation/Decorators.js';

const isFirefox = browser === 'firefox';

/**
    Class: O.TextInputView

    Extends: O.AbstractInputView

    A text input control. The `value` property is two-way bindable, representing
    the input text.
*/
const TextInputView = Class({
    Name: 'TextInputView',

    Extends: AbstractInputView,

    init: function (/* ...mixins */) {
        TextInputView.parent.constructor.apply(this, arguments);
        this._settingFromInput = false;
        this._verticalBorderWidth = 0;
    },

    /**
        Property: O.TextInputView#isMultiline
        Type: Boolean
        Default: false

        If set to true, the text field will accept line breaks.

        This property *must not* be changed after the view has been rendered.
    */
    isMultiline: false,

    /**
        Property: O.TextInputView#isExpanding
        Type: Boolean
        Default: false

        If <#isMultiline> is set to true, setting <#isExpanding> to true will
        make it automatically expand vertically to fit its contents, rather than
        show a scrollbar.
    */
    isExpanding: false,

    /**
        Property: O.TextInputView#isHighlighted
        Type: Boolean
        Default: false

        If true, a `highlight` class will be added to the view's class name.
        This is a styling hook for highlighting the view, e.g. if it fails
        validation.
    */
    isHighlighted: false,

    /**
        Property: O.TextInputView#inputType
        Type: String
        Default: "text"

        The type property for the <input> DOM node (e.g. "password", "tel" etc.)
    */
    inputType: 'text',

    /**
        Property: O.TextInputView#placeholder
        Type: String
        Default: undefined

        Placeholder text to be displayed in the text input when it is empty.
    */
    placeholder: undefined,

    /**
        Property: O.TextInputView#value
        Type: String
        Default: ''

        The value currently input in the text field.
    */
    value: '',

    /**
        Property: O.TextInputView#selection
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

    */
    selection: function (selection) {
        const control = this._domControl;
        const isNumber = typeof selection === 'number';
        let start = selection ? (isNumber ? selection : selection.start) : 0;
        let end = selection
            ? isNumber
                ? selection
                : selection.end || start
            : start;
        if (selection !== undefined) {
            // Ensure any value changes have been drawn.
            this.redraw();
            // Firefox will throw an error if the control is not actually in the
            // document when trying to set the selection. There might be other
            // situations where it does so as well, so just using a try/catch to
            // guard against all.
            try {
                control.setSelectionRange(start, end);
            } catch (error) {}
        } else {
            // Firefox sometimes throws an error if you try to read the
            // selection. Again, probably if the control is not actually in the
            // document.
            try {
                start = control.selectionStart;
                end = control.selectionEnd;
            } catch (error) {}
        }
        return (
            selection || {
                start,
                end,
            }
        );
    }
        .property()
        .nocache(),

    invalidateSelection: function () {
        this.computedPropertyDidChange('selection');
    }.on('click', 'selectionchange'),

    /**
        Property: O.TextInputView#blurOnKeys
        Type: Object
        Default: { Escape: true }

        For each truthy value in the object, if the user is focused in the
        text view and hits the key, the focus will be removed.
    */
    blurOnKeys: { Escape: true },

    // --- Render ---

    baseClassName: 'v-TextInput',

    /**
        Property: O.TextInputView#className
        Type: String

        Overrides default in <O.View#className>. Will have the class `v-TextInput`,
        and any classes given in the <#type> property, along with the following
        other class names dependent on state:

        is-highlight - The <#isHighlighted> property is true.
        is-focused  - The <#isFocused> property is true.
        is-invalid   - The <#isValid> property is false.
        is-disabled  - The <#isDisabled> property is true.
    */
    className: function () {
        const type = this.get('type');
        return (
            'v-TextInput' +
            (this.get('isExpanding') ? ' v-TextInput--expanding' : '') +
            (this.get('isMultiline') ? ' v-TextInput--multiline' : '') +
            (this.get('isHighlighted') ? ' is-highlighted' : '') +
            (this.get('isFocused') ? ' is-focused' : '') +
            (this.get('isValid') ? '' : ' is-invalid') +
            (this.get('isDisabled') ? ' is-disabled' : '') +
            (type ? ' ' + type : '')
        );
    }.property(
        'type',
        'isExpanding',
        'isHighlighted',
        'isFocused',
        'isValid',
        'isDisabled',
    ),

    drawControl() {
        const isMultiline = this.get('isMultiline');
        return (this._domControl = el(isMultiline ? 'textarea' : 'input', {
            id: this.get('id') + '-input',
            className: this.get('baseClassName') + '-input',
            rows: isMultiline ? '1' : undefined,
            name: this.get('name'),
            type: this.get('inputType'),
            disabled: this.get('isDisabled'),
            tabIndex: this.get('tabIndex'),
            placeholder: this.get('placeholder') || undefined,
            value: this.get('value'),
        }));
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.TextInputView#textNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    textNeedsRedraw: function (self, property, oldValue) {
        const isValue = property === 'value';
        if (!isValue || !this._settingFromInput) {
            this.propertyNeedsRedraw(self, property, oldValue);
        }
        if (isValue && this.get('isExpanding')) {
            this.propertyNeedsRedraw(self, 'textHeight', oldValue);
        }
    }.observes('value', 'isExpanding', 'placeholder', 'inputType'),

    /**
        Method: O.TextInputView#redrawPlaceholder

        Updates the placeholder text in the DOM when the <#placeholder> property
        changes.
    */
    redrawPlaceholder() {
        this._domControl.placeholder = this.get('placeholder');
    },

    redrawInputType() {
        this._domControl.type = this.get('inputType');
    },

    redrawTextHeight() {
        // Firefox gets pathologically slow when resizing really large text
        // areas, so automatically turn this off in such a case.
        // 2^13 chars is an arbitrary cut off point that seems to be reasonable
        // in practice
        if (isFirefox && (this.get('value') || '').length > 8192) {
            this.set('isExpanding', false);
            return;
        }
        const control = this._domControl;
        const style = control.style;
        const scrollView = this.getParent(ScrollView);
        // Set to auto to collapse it back to one line, otherwise it would
        // never shrink if you delete text.
        style.height = 'auto';
        const scrollHeight = control.scrollHeight;
        // Presto returns 0 immediately after appending to doc.
        if (scrollHeight) {
            style.height = this._verticalBorderWidth + scrollHeight + 'px';
        }
        // Collapsing the height will mess with the scroll, so make sure we
        // reset the scroll position back to what it was.
        if (scrollView) {
            scrollView.redrawScroll();
        }
        this.didResize();
    },

    redrawIsExpanding() {
        if (this.get('isExpanding')) {
            this.redrawTextHeight();
        } else {
            this._domControl.style.height = 'auto';
            this.didResize();
            // Scroll to cursor
            if (this.get('isFocused')) {
                this.blur().focus();
            }
        }
    },

    // --- Activate ---

    selectAll() {
        return this.set('selection', {
            start: 0,
            end: this.get('value').length,
        });
    },

    copySelectionToClipboard() {
        let focused = null;
        if (!this.get('isFocused')) {
            focused = document.activeElement;
            this.focus();
        }
        let didSucceed = false;
        try {
            didSucceed = document.execCommand('copy');
        } catch (error) {}
        if (focused) {
            focused.focus();
        }
        return didSucceed;
    },

    // --- Scrolling and focus ---

    savedSelection: null,

    /**
        Method: O.TextInputView#didEnterDocument

        Overridden to restore scroll position and selection. See
        <O.View#didEnterDocument>.
    */
    didEnterDocument() {
        TextInputView.parent.didEnterDocument.call(this);
        const control = this._domControl;
        if (this.get('isMultiline')) {
            if (this.get('isExpanding')) {
                const style = getComputedStyle(this._domControl);
                if (style.boxSizing === 'border-box') {
                    this._verticalBorderWidth =
                        parseInt(style.borderTopWidth, 10) +
                        parseInt(style.borderBottomWidth, 10);
                }
                this.redrawTextHeight();
            }
            // Restore scroll positions:
            const left = this.get('scrollLeft');
            const top = this.get('scrollTop');
            if (left) {
                control.scrollLeft = left;
            }
            if (top) {
                control.scrollTop = top;
            }
        }
        control.addEventListener('scroll', this, false);
        const selection = this.get('savedSelection');
        if (selection) {
            this.set('selection', selection).focus();
            this.set('savedSelection', null);
        }
        return this;
    },

    /**
        Method: O.TextInputView#willLeaveDocument

        Overridden to save scroll position and selection. See
        <O.View#willLeaveDocument>.
    */
    willLeaveDocument() {
        // If focused, save cursor position
        if (this.get('isFocused')) {
            this.set('savedSelection', this.get('selection'));
            this.blur();
        }
        // Stop listening for scrolls:
        this._domControl.removeEventListener('scroll', this, false);
        return TextInputView.parent.willLeaveDocument.call(this);
    },

    /**
        Method (private): O.TextInputView#_syncBackScrolls

        Sets the <O.View#scrollLeft> and <O.View#scrollTop> properties whenever
        the user scrolls the textarea.

        Parameters:
            event - {Event} The scroll event.
    */
    _syncBackScrolls: function (event) {
        const control = this._domControl;
        const left = control.scrollLeft;
        const top = control.scrollTop;

        this.beginPropertyChanges()
            .set('scrollLeft', left)
            .set('scrollTop', top)
            .endPropertyChanges();

        event.stopPropagation();
    }.on('scroll'),

    // --- Keep state in sync with render ---

    /**
        Method: O.TextInputView#syncBackValue

        Updates the <#value> property when the user interacts with the textarea.

        Parameters:
            event - {Event} The input event.
    */
    syncBackValue: function () {
        this._settingFromInput = true;
        this.userDidInput(this._domControl.value);
        this._settingFromInput = false;
    }.on('input'),

    /**
        Method (private): O.TextInputView#_onClick

        Focus and set selection to the end.

        Parameters:
            event - {Event} The click event.
    */
    _onClick: function (event) {
        if (event.target === this.get('layer')) {
            this.set('selection', this.get('value').length).focus();
        }
    }.on('click'),

    /**
        Method (private): O.TextInputView#_onKeypress

        Stop IE automatically focussing the nearest button when the user hits
        enter in single line text inputs.

        Parameters:
            event - {Event} The keypress event.
    */
    _onKeypress: function (event) {
        // If key == enter, IE will automatically focus the nearest button
        // (presumably as though it were submitting the form). Stop this
        // unless we're actually in a form.
        if (
            !this.get('isMultiline') &&
            lookupKey(event, true) === 'Enter' &&
            !nearest(this.get('layer'), 'FORM')
        ) {
            event.preventDefault();
        }
    }.on('keypress'),

    /**
        Method (private): O.TextInputView#_blurOnKey

        Blur the text area when the user hits certain keys, provided by the
        <#blurOnKeys> property.

        Parameters:
            event - {Event} The keyup event.
    */
    _blurOnKey: function (event) {
        const key = lookupKey(event, true);
        if (this.get('blurOnKeys')[key]) {
            this.blur();
        }
    }.on('keyup'),
});

/* Don't redraw when the user is typing; we handle redrawing value in
   textNeedsRedraw so remove the abstractInputView observer */
meta(TextInputView.prototype).removeObserver('value', {
    object: null,
    method: 'abstractInputNeedsRedraw',
});

export { TextInputView };
