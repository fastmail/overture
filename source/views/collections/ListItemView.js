import { Class } from '../../core/Core';
import '../../foundation/ComputedProps';  // For Function#property
import '../../foundation/RunLoop';  // For Function#nextFrame
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
        ListItemView.parent.constructor.call( this, mixin );
    },

    positioning: 'absolute',

    layout: function () {
        const index = this.get( 'index' );
        const itemHeight = this.get( 'itemHeight' );
        const isNew = this.get( 'animateIn' ) && !this.get( 'isInDocument' );
        const y = ( index - ( isNew ? 1 : 0 ) ) * itemHeight;
        return {
            top: y,
            opacity: isNew ? 0 : 1,
        };
    }.property(),

    layoutWillChange: function () {
        this.computedPropertyDidChange( 'layout' );
    }.nextLoop().observes( 'index', 'itemHeight' ),

    resetLayout: function () {
        if ( this.get( 'animateIn' ) ) {
            this.computedPropertyDidChange( 'layout' );
        }
    }.nextLoop().observes( 'isInDocument' ),
});

export default ListItemView;
