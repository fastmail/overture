import { Class } from '../../core/Core';
import '../../foundation/ComputedProps';  // For Function#property
import '../../foundation/RunLoop';  // For Function#nextFrame
import UA from '../../ua/UA';
import View from '../View';

const ListItemView = Class({

    Extends: View,

    content: null,

    index: 0,
    itemHeight: 32,

    selection: null,
    isSelected: false,

    animateIn: false,

    init ( mixin ) {
        const selection = mixin.selection;
        const content = mixin.content;
        if ( selection && content ) {
            this.isSelected = selection.isStoreKeySelected(
                content.get( 'storeKey' )
            );
        }
        ListItemView.parent.init.call( this, mixin );
    },

    positioning: 'absolute',

    layout: ( UA.cssProps.transform3d ? function () {
        const index = this.get( 'index' );
        const itemHeight = this.get( 'itemHeight' );
        const isNew = this.get( 'animateIn' ) && !this.get( 'isInDocument' );
        const y = ( index - ( isNew ? 1 : 0 ) ) * itemHeight;
        return {
            transform: 'translate3d(0,' + y + 'px,0)',
            opacity: isNew ? 0 : 1,
        };
    } : function () {
        const index = this.get( 'index' );
        const itemHeight = this.get( 'itemHeight' );
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
