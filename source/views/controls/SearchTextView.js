import { Class } from '../../core/Core.js';
import { loc } from '../../localisation/i18n.js';
import { when } from '../collections/SwitchView.js';
import { TextView } from './TextView.js';
import { ClearSearchButtonView } from './ClearSearchButtonView.js';

const SearchTextView = Class({
    Name: 'SearchTextView',

    Extends: TextView,

    type: 'v-SearchText',

    icon: null,

    // Helps password managers know this is not a username input!
    name: 'search',

    draw(layer) {
        const children = SearchTextView.parent.draw.call(this, layer);
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

export { SearchTextView };
