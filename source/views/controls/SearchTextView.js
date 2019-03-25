import { Class } from '../../core/Core';
import { loc } from '../../localisation/LocaleController';
import { when } from '../collections/SwitchView';
import TextView from './TextView';
import ClearSearchButtonView from './ClearSearchButtonView';

const SearchTextView = Class({

    Extends: TextView,

    type: 'v-SearchText',

    icon: null,

    // Helps password managers know this is not a username input!
    name: 'search',

    draw ( layer ) {
        const children = SearchTextView.parent.draw.call( this, layer );
        children.push(
            this.get( 'icon' ),
            when( this, 'value' ).show([
                new ClearSearchButtonView({
                    label: loc( 'Clear Search' ),
                    target: this,
                    method: 'reset',
                }),
            ]).end()
        );
        return children;
    },

    reset () {
        this.set( 'value', '' )
            .blur();
    },
});

export default SearchTextView;
