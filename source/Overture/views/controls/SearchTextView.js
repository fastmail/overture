import { Class } from '../../core/Core';
import { loc } from '../../localisation/LocaleController';
import TextView from './TextView';
import ClearSearchButtonView from './ClearSearchButtonView';

const SearchTextView = Class({

    Extends: TextView,

    type: 'v-SearchText',

    icon: null,

    draw ( layer, Element, el ) {
        const children =
                SearchTextView.parent.draw.call( this, layer, Element, el );
        children.push(
            this.get( 'icon' ),
            Element.when( this, 'value' ).show([
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
