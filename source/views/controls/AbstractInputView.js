import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { AbstractControlView } from './AbstractControlView.js';

/* { on, observes } from */
import '../../foundation/Decorators.js';

/**
    Class: O.AbstractInputView

    Extends: O.View

    The superclass for most DOM-control view classes. This is an abstract class
    and should not be instantiated directly; it is only intended to be
    subclassed.
*/
const AbstractInputView = Class({
    Name: 'AbstractInputView',

    Extends: AbstractControlView,

    /**
        Property: O.AbstractInputView#label
        Type: String|Element|null
        Default: ''

        A label for the control, to be displayed next to it.
    */
    label: '',

    /**
        Property: O.AbstractInputView#label
        Type: String|Element|null
        Default: ''

        A description for the control, to be displayed next to it.
    */
    description: '',

    /**
        Property: O.AbstractInputView#name
        Type: String|undefined
        Default: undefined

        If set, this will be the name attribute of the control.
    */
    name: undefined,

    /**
        Property: O.AbstractInputView#value
        Type: *
        Default: false

        The value represented by this control, for example true/false if a
        checkbox is checked/unchecked, or the text input into a textarea.
    */
    value: false,

    /**
        Property: O.TextInputView#inputAttributes
        Type: Object

        Extra attributes to add to the text view. Examples include:

        - maxLength: Number
        - autocomplete: 'on' or 'off'
        - autocapitalize: 'on' or 'off'
        - autocorrect: 'on' or 'off'
        - pattern: String (regexp)
    */
    inputAttributes: {
        autocomplete: 'off',
    },

    /**
        Property: O.AbstractInputView#layerTag
        Type: String
        Default: 'div'

        Overrides default in <O.View#layerTag>.
    */
    layerTag: 'div',

    /**
        Property (private): O.AbstractInputView#_domControl
        Type: Element|null

        A reference to the DOM control managed by the view.
    */
    _domControl: null,

    /**
        Method: O.AbstractInputView#drawControl

        Overridden to set properties and add label. See <O.View#draw>.
    */
    drawControl() {
        return (this._domControl = el('input', {
            id: this.get('id') + '-input',
            disabled: this.get('isDisabled'),
            name: this.get('name'),
            value: this.get('value'),
        }));
    },

    drawLabel(label) {
        const control = this._domControl;
        return el('label', { for: control && control.id }, [label]);
    },

    drawDescription(description) {
        return el('p', [description]);
    },

    /**
        Method: O.AbstractInputView#draw

        Overridden to set properties and add label. See <O.View#draw>.
    */
    draw(layer) {
        const control = this.drawControl();

        let label = this.get('label');
        if (label) {
            label = this.drawLabel(label);
        }

        let description = this.get('description');
        if (description) {
            description = this.drawDescription(description);
        }

        this.redrawInputAttributes(layer);
        this.redrawTabIndex(layer);

        return [label, control, description];
    },

    // --- Keep render in sync with state ---

    abstractInputNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('inputAttributes', 'isDisabled', 'name', 'value'),

    /**
        Method: O.TextInputView#redrawInputAttributes

        Updates any other properties of the `<input>` element.
    */
    redrawInputAttributes() {
        const inputAttributes = this.get('inputAttributes');
        const control = this._domControl;
        for (const property in inputAttributes) {
            control.set(property, inputAttributes[property]);
        }
    },

    /**
        Method: O.AbstractInputView#redrawIsDisabled

        Updates the disabled attribute on the DOM control to match the
        isDisabled property of the view.
    */
    redrawIsDisabled() {
        this._domControl.disabled = this.get('isDisabled');
    },

    /**
        Method: O.AbstractInputView#redrawName

        Updates the name attribute on the DOM control to match the name
        property of the view.
    */
    redrawName() {
        this._domControl.name = this.get('name');
    },

    /**
        Method: O.AbstractInputView#redrawValue

        Updates the content of the input to match the <#value> property.
    */
    redrawValue() {
        this._domControl.value = this.get('value');
    },

    // --- Focus ---

    /**
        Method: O.AbstractInputView#focus

        Focusses the control.

        Returns:
            {O.AbstractInputView} Returns self.
    */
    focus() {
        if (this.get('isInDocument')) {
            this._domControl.focus({
                preventScroll: true,
            });
            // Fire event synchronously.
            if (!this.get('isFocused')) {
                this.fire('focus', {
                    target: this._domControl,
                    targetView: this,
                });
            }
        }
        return this;
    },

    /**
        Method: O.AbstractInputView#blur

        Removes focus from the control.

        Returns:
            {O.AbstractInputView} Returns self.
    */
    blur() {
        if (this.get('isInDocument')) {
            this._domControl.blur();
            // Fire event synchronously.
            if (this.get('isFocused')) {
                this.fire('blur', {
                    target: this._domControl,
                    targetView: this,
                });
            }
        }
        return this;
    },

    /**
        Method (private): O.AbstractInputView#_updateIsFocused

        Updates the <#isFocused> property.

        Parameters:
            event - {Event} The focus event.
    */
    _updateIsFocused: function (event) {
        this.set(
            'isFocused',
            event.type === 'focus' && event.target === this._domControl,
        );
    }.on('focus', 'blur'),

    // --- Input ---

    userDidInput(value) {
        this.set('value', value);
    },
});

export { AbstractInputView };
