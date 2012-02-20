// -------------------------------------------------------------------------- \\
// File: AnimatableProps.js                                                   \\
// Module: Animation                                                          \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

NS.AnimatableProps = {

    setWithAnimation: function ( key, value, animation ) {
        if ( !animation ) { animation = this.getAnimationForKey( key ); }
        animation.animate( value );
        return this;
    },
    
    getAnimationForKey: function ( key ) {
        return this.get( key + 'Animation' ) || new NS.Animation({
            object: this,
            property: key
        });
    }
};

}( O ) );