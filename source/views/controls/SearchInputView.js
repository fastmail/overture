import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { loc } from '../../localisation/i18n.js';
import { when } from '../collections/SwitchView.js';
import { Activatable } from './Activatable.js';
import { ClearSearchButtonView } from './ClearSearchButtonView.js';
import { TextInputView } from './TextInputView.js';

const SearchInputView = Class({
    Name: 'SearchInputView',

    Extends: TextInputView,

    Mixin: [Activatable],

    icon: null,

    inputAttributes: {
        autocapitalize: 'off',
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
    },

    // Helps password managers know this is not a username input!
    name: 'search',

    baseClassName: 'v-SearchInput',

    className: function () {
        const type = this.get('type');
        return (
            this.get('baseClassName') +
            (this.get('isDisabled') ? ' is-disabled' : '') +
            (this.get('isFocused') ? ' is-focused' : '') +
            (type ? ' ' + type : '')
        );
    }.property('type', 'isDisabled', 'isFocused'),

    drawControl() {
        return (this._domControl = el('input', {
            id: this.get('id') + '-input',
            className: this.get('baseClassName') + '-input',
            name: this.get('name'),
            disabled: this.get('isDisabled'),
            placeholder: this.get('placeholder'),
            value: this.get('value'),
        }));
    },

    draw(layer) {
        const control = this.drawControl();

        this.redrawInputAttributes(layer);
        this.redrawTabIndex(layer);

        return [
            control,
            this.get('icon'),
            when(this, 'value')
                .show([
                    new ClearSearchButtonView({
                        label: loc('Clear search'),
                        target: this,
                        method: 'reset',
                    }),
                ])
                .end(),
        ];
    },

    /**
        Method: O.SearchInputView#activate

        Overridden to focus the text view. See <O.Activatable#activate>.
    */
    activate() {
        this.focus();
    },

    reset() {
        this.set('value', '').focus();
    },
});

export { SearchInputView };
