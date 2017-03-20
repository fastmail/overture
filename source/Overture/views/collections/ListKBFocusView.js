import { Class } from '../../core/Core.js';
import '../../core/Number.js';  // For Number#limit
import { bind } from '../../foundation/Binding.js';
import '../../foundation/ComputedProps.js';  // For Function#property, #nocache
import '../../foundation/RunLoop.js';  // For Function#queue
import ScrollView from '../containers/ScrollView.js';
import View from '../View.js';
import ViewEventsController from '../ViewEventsController.js';

var ListKBFocusView = Class({

    Extends: View,

    selection: null,
    singleSelection: null,

    index: bind( 'singleSelection*index' ),
    record: bind( 'singleSelection*record' ),

    itemHeight: 32,

    keys: {
        j: 'goNext',
        k: 'goPrev',
        x: 'select',
        'shift-x': 'select',
        o: 'trigger',
        enter: 'trigger',
        s: 'star',
    },

    className: 'v-ListKBFocus',

    positioning: 'absolute',

    layout: function () {
        var itemHeight = this.get( 'itemHeight' ),
            index = this.get( 'index' ),
            singleSelection = this.get( 'singleSelection' ),
            list = singleSelection.get( 'content' );
        if ( index > -1 && list &&
                list.getObjectAt( index ) !== this.get( 'record' ) ) {
            index = -1;
        }
        return {
            top: itemHeight * index,
            height: index < 0 ? 0 : itemHeight,
        };
    }.property( 'itemHeight', 'index', 'record' ),

    didEnterDocument: function () {
        var keys = this.get( 'keys' ),
            shortcuts = ViewEventsController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.register( key, this, keys[ key ] );
        }
        this.checkInitialScroll();
        return ListKBFocusView.parent.didEnterDocument.call( this );
    },
    willLeaveDocument: function () {
        var keys = this.get( 'keys' ),
            shortcuts = ViewEventsController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.deregister( key, this, keys[ key ] );
        }
        return ListKBFocusView.parent.willLeaveDocument.call( this );
    },

    // Scroll to centre widget on screen with no animation
    checkInitialScroll: function () {
        if ( this.get( 'index' ) > -1 && this.get( 'distanceFromVisRect' ) ) {
            this.scrollIntoView( 0, false );
        }
    }.queue( 'after' ),

    checkScroll: function () {
        var distance = this.get( 'distanceFromVisRect' );
        if ( distance ) {
            this.scrollIntoView( distance < 0 ? -0.6 : 0.6, true );
        }
    }.queue( 'after' ),

    distanceFromVisRect: function () {
        var scrollView = this.getParent( ScrollView );
        if ( scrollView ) {
            var scrollTop = scrollView.get( 'scrollTop' ),
                position = this.getPositionRelativeTo( scrollView ),
                top = position.top,
                above = top - scrollTop;

            if ( above < 0 ) { return above; }

            var scrollHeight = scrollView.get( 'pxHeight' ),
                below = top + this.get( 'pxHeight' ) - scrollTop - scrollHeight;

            if ( below > 0 ) { return below; }
        }
        return 0;
    }.property().nocache(),

    scrollIntoView: function ( offset, withAnimation ) {
        var scrollView = this.getParent( ScrollView );
        if ( scrollView ) {
            var scrollHeight = scrollView.get( 'pxHeight' ),
                itemHeight = this.get( 'pxHeight' ),
                top = this.getPositionRelativeTo( scrollView ).top;

            if ( offset && -1 <= offset && offset <= 1 ) {
                offset = ( offset * ( scrollHeight - itemHeight ) ) >> 1;
            }
            scrollView.scrollTo( 0,
                Math.max( 0,
                    top +
                    ( ( itemHeight - scrollHeight ) >> 1 ) +
                    ( offset || 0 )
                ),
                withAnimation
            );
        }
    },

    go: function ( delta ) {
        var index = this.get( 'index' ),
            singleSelection = this.get( 'singleSelection' ),
            list = singleSelection.get( 'content' ),
            length = list && list.get( 'length' ) || 0;
        if ( delta === 1 && index > -1 && list &&
                list.getObjectAt( index ) !== this.get( 'record' ) ) {
            delta = 0;
        }
        if ( delta ) {
            singleSelection.set( 'index',
                ( index + delta ).limit( 0, length - 1 ) );
        } else {
            singleSelection.propertyDidChange( 'index' );
        }
        if ( this.get( 'isInDocument' ) ) {
            this.checkScroll();
        }
    },
    goNext: function () {
        this.go( 1 );
    },
    goPrev: function () {
        this.go( -1 );
    },
    select: function ( event ) {
        var index = this.get( 'index' ),
            selection = this.get( 'selection' ),
            record = this.get( 'record' );
        // Check it's next to a loaded record.
        if ( selection && record ) {
            selection.selectIndex( index,
                !selection.isStoreKeySelected( record.get( 'storeKey' ) ),
                event.shiftKey );
        }
    },
    trigger: function () {},
    star: function () {},
});

export default ListKBFocusView;
