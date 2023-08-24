import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { bind } from '../../foundation/Binding.js';
import { loc } from '../../localisation/i18n.js';
import { ButtonView } from './ButtonView.js';
import { TextInputView } from './TextInputView.js';

// ---

const PasswordInputView = Class({
    Name: 'PasswordInputView',

    Extends: TextInputView,

    showPassword: false,

    inputType: function () {
        return this.get('showPassword') ? 'text' : 'password';
    }.property('showPassword'),

    inputAttributes: {
        name: 'current-password',
        autocapitalize: 'off',
        autocomplete: 'current-password webauthn',
        autocorrect: 'off',
        spellcheck: 'false',
    },

    icon: null,

    drawControl() {
        const controlEl =
            PasswordInputView.parent.drawControl.call(this).firstChild;
        controlEl.className = 'v-PasswordInput-input';
        return el('div.v-PasswordInput-wrapper.v-TextInput-input.u-flex', [
            controlEl,
            new ButtonView({
                // This is purely visual presentation so not helpful for screen
                // readers; hide the button entirely.
                ariaAttributes: {
                    hidden: true,
                },
                tabIndex: -1,
                icon: bind(this, 'icon'),
                type: 'v-PasswordInput-toggle v-Button--sizeM v-Button--iconOnly v-Button--tooltipLabel',
                label: bind(this, 'showPassword', (showPassword) =>
                    showPassword
                        ? loc('ACTION_HIDE_PASSWORD')
                        : loc('ACTION_SHOW_PASSWORD'),
                ),
                target: this,
                method: 'toggleShowPassword',
            }),
        ]);
    },

    toggleShowPassword() {
        this.toggle('showPassword');
    },
});

// ---

export { PasswordInputView };
