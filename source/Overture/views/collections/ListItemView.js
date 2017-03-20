// -------------------------------------------------------------------------- \\
// File: ListItemView.js                                                      \\
// Module: CollectionViews                                                    \\
// Requires: Core, Foundation, UA, View                                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../../core/Core.js';
import '../../foundation/ComputedProps.js';  // For Function#property
import '../../foundation/RunLoop.js';  // For Function#nextFrame
import UA from '../../ua/UA.js';
import View from '../View.js';

var ListItemView = Class({

    Extends: View,

    content: null,

    index: 0,
    itemHeight: 32,

    selection: null,
    isSelected: false,

    animateIn: false,

    init: function ( mixin ) {
        var selection = mixin.selection,
            content = mixin.content;
        if ( selection && content ) {
            this.isSelected = selection.isStoreKeySelected(
                content.get( 'storeKey' )
            );
        }
        ListItemView.parent.init.call( this, mixin );
    },

    positioning: 'absolute',

    layout: ( UA.cssProps.transform3d ? function () {
        var index = this.get( 'index' ),
            itemHeight = this.get( 'itemHeight' ),
            isNew = this.get( 'animateIn' ) && !this.get( 'isInDocument' ),
            y = ( index - ( isNew ? 1 : 0 ) ) * itemHeight;
        return {
            transform: 'translate3d(0,' + y + 'px,0)',
            opacity: isNew ? 0 : 1,
        };
    } : function () {
        var index = this.get( 'index' ),
            itemHeight = this.get( 'itemHeight' );
        return {
            top: index * itemHeight,
        };
    }).property( 'index', 'itemHeight' ),

    resetLayout: function () {
        if ( this.get( 'animateIn' ) ) {
            this.computedPropertyDidChange( 'layout' );
        }
    }.nextFrame().observes( 'isInDocument' ),
});

export default ListItemView;
