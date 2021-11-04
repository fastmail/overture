import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { AbstractControlView } from './AbstractControlView.js';

/**
    Class: O.ToggleView

    Extends: O.AbstractControlView

    A toggle control view. The `value` property is two-way bindable,
    representing the state of the toggle (`true` => checked).
*/
const ToggleView = Class({
    Name: 'ToggleView',

    Extends: AbstractControlView,

    /**
        Property: O.ToggleView#icon
        Type: Element|null

        A reference to the SVG icon that replaces the native <input> element.
    */
    icon: null,

    /**
        Property: O.AbstractControlView#tabIndex
        Type: Number
        Default: 0

        Overrides default in <O.AbstractControlView#tabIndex>.
    */
    tabIndex: 0,

    // --- Render ---

    /**
        Property: O.ToggleView#layerTag
        Type: String
        Default: 'div'

        Overrides default in <O.AbstractControlView#layerTag>.
    */
    layerTag: 'div',

    /**
        Property: O.ToggleView#type
        Type: String
        Default: ''

        A space-separated list of CSS classnames to give the layer in the DOM,
        irrespective of state.
    */
    type: '',

    /**
        Property: O.ToggleView#className
        Type: String
        Default: 'v-Toggle'

        Overrides default in <O.View#className>.
    */
    className: function () {
        const type = this.get('type');
        return (
            'v-Toggle' +
            (this.get('value') ? ' is-checked' : ' is-unchecked') +
            (this.get('isDisabled') ? ' is-disabled' : '') +
            (type ? ' ' + type : '')
        );
    }.property('type', 'value', 'isDisabled'),

    /**
        Method: O.ToggleView#draw

        Overridden to draw toggle in layer. See <O.View#draw>.
    */
    draw(/*layer*/) {
        const id = this.get('id');
        const icon = this.get('icon');
        const control = (this._domControl = el('input', {
            type: 'checkbox',
            id: id + '-input',
            checked: this.get('value'),
            disabled: this.get('isDisabled'),
            hidden: !!icon,
            onchange: (event) => {
                this.userDidInput(event.target.checked);
            },
        }));

        const name = this.get('name');
        if (name) {
            control.name = name;
        }

        const label = (this._domLabel = el('p.u-label.u-trim', [
            this.get('label'),
        ]));

        let description = this.get('description');
        if (description) {
            label.classList.add('u-trim-top');
            description = el('p.u-description.u-trim.u-trim-bottom', [
                description,
            ]);
        }

        return [
            control,
            el(
                'label',
                {
                    for: control.id,
                    tabIndex: this.get('tabIndex'),
                },
                [
                    icon ? el('i.v-Toggle-icon', [icon]) : null,
                    el('div.v-Toggle-text', [label, description]),
                ],
            ),
        ];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.ToggleView#checkboxNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    checkboxNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('value'),

    /**
        Method: O.ToggleView#redrawValue

        Updates the checked status of the DOM `<input type="checkbox">` to match
        the value property of the view.
    */
    redrawValue() {
        this._domControl.checked = this.get('value');
    },

    // --- Activate ---

    /**
        Method: O.ToggleView#activate

        Overridden to toggle the checked status of the control. See
        <O.AbstractControlView#activate>.
    */
    activate() {
        if (!this.get('isDisabled')) {
            this.userDidInput(!this.get('value'));
        }
    },

    /**
        Method: O.ToggleView#keydown

        Pressing the space key toggles the control.
    */
    keydown: function (event) {
        if (event.key !== ' ') {
            return;
        }
        event.target.click();
    }.on('keydown'),
});

export { ToggleView };
