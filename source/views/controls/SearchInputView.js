import { Class } from '../../core/Core.js';
import { loc } from '../../localisation/i18n.js';
import { when } from '../collections/SwitchView.js';
import { ClearSearchButtonView } from './ClearSearchButtonView.js';
import { TextInputView } from './TextInputView.js';

const SearchInputView = Class({
    Name: 'SearchInputView',

    Extends: TextInputView,

    type: 'v-SearchInput',

    icon: null,

    inputAttributes: {
        autocapitalize: 'off',
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
    },

    // Helps password managers know this is not a username input!
    name: 'search',

    draw(layer) {
        const children = SearchInputView.parent.draw.call(this, layer);
        children.push(
            this.get('icon'),
            when(this, 'value')
                .show([
                    new ClearSearchButtonView({
                        label: loc('Clear Search'),
                        target: this,
                        method: 'reset',
                    }),
                ])
                .end(),
        );
        return children;
    },

    reset() {
        this.set('value', '').focus();
    },
});

export { SearchInputView };
