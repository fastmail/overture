// -------------------------------------------------------------------------- \\
// File: SearchTextView.js                                                    \\
// Module: ControlViews                                                       \\
// Requires: Core, Localisation, TextView.js, ClearSearchButtonView.js        \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../../core/Core.js';
import { loc } from '../../localisation/LocaleController.js';
import TextView from './TextView.js';
import ClearSearchButtonView from './ClearSearchButtonView.js';

var SearchTextView = Class({

    Extends: TextView,

    type: 'v-SearchText',

    icon: null,

    draw: function ( layer, Element, el ) {
        var children =
                SearchTextView.parent.draw.call( this, layer, Element, el );
        children.push(
            this.get( 'icon' ),
            Element.when( this, 'value' ).show([
                new ClearSearchButtonView({
                    label: loc( 'Clear Search' ),
                    target: this,
                    method: 'reset'
                })
            ]).end()
        );
        return children;
    },

    reset: function () {
        this.set( 'value', '' )
            .blur();
    }
});

export default SearchTextView;
