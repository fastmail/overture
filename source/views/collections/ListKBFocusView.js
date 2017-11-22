import { Class } from '../../core/Core';
import '../../core/Number';  // For Number#limit
import { bind } from '../../foundation/Binding';
import '../../foundation/ComputedProps';  // For Function#property, #nocache
import '../../foundation/RunLoop';  // For Function#queue
import ScrollView from '../containers/ScrollView';
import View from '../View';
import ViewEventsController from '../ViewEventsController';

const ListKBFocusView = Class({

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
        X: 'select',
        o: 'trigger',
        Enter: 'trigger',
        s: 'star',
    },

    className: 'v-ListKBFocus',

    positioning: 'absolute',

    layout: function () {
        const itemHeight = this.get( 'itemHeight' );
        let index = this.get( 'index' );
        const singleSelection = this.get( 'singleSelection' );
        const list = singleSelection.get( 'content' );
        if ( index > -1 && list &&
                list.getObjectAt( index ) !== this.get( 'record' ) ) {
            index = -1;
        }
        return {
            top: itemHeight * index,
            height: index < 0 ? 0 : itemHeight,
        };
    }.property( 'itemHeight', 'index', 'record' ),

    didEnterDocument () {
        const keys = this.get( 'keys' );
        const shortcuts = ViewEventsController.kbShortcuts;
        for ( const key in keys ) {
            shortcuts.register( key, this, keys[ key ] );
        }
        this.checkInitialScroll();
        return ListKBFocusView.parent.didEnterDocument.call( this );
    },
    willLeaveDocument () {
        const keys = this.get( 'keys' );
        const shortcuts = ViewEventsController.kbShortcuts;
        for ( const key in keys ) {
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
        const distance = this.get( 'distanceFromVisRect' );
        if ( distance ) {
            this.scrollIntoView( distance < 0 ? -0.6 : 0.6, true );
        }
    }.queue( 'after' ),

    distanceFromVisRect: function () {
        const scrollView = this.getParent( ScrollView );
        if ( scrollView ) {
            const scrollTop = scrollView.get( 'scrollTop' );
            const position = this.getPositionRelativeTo( scrollView );
            const top = position.top;
            const above = top - scrollTop;

            if ( above < 0 ) { return above; }

            const scrollHeight = scrollView.get( 'pxHeight' );
            const below = top + this.get( 'pxHeight' ) -
                scrollTop - scrollHeight;

            if ( below > 0 ) { return below; }
        }
        return 0;
    }.property().nocache(),

    scrollIntoView ( offset, withAnimation ) {
        const scrollView = this.getParent( ScrollView );
        if ( scrollView ) {
            const scrollHeight = scrollView.get( 'pxHeight' );
            const itemHeight = this.get( 'pxHeight' );
            const top = this.getPositionRelativeTo( scrollView ).top;

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

    go ( delta ) {
        const index = this.get( 'index' );
        const singleSelection = this.get( 'singleSelection' );
        const list = singleSelection.get( 'content' );
        const length = list && list.get( 'length' ) || 0;
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
    goNext () {
        this.go( 1 );
    },
    goPrev () {
        this.go( -1 );
    },
    select ( event ) {
        const index = this.get( 'index' );
        const selection = this.get( 'selection' );
        const record = this.get( 'record' );
        // Check it's next to a loaded record.
        if ( selection && record ) {
            selection.selectIndex( index,
                !selection.isStoreKeySelected( record.get( 'storeKey' ) ),
                event.shiftKey );
        }
    },
    trigger () {},
    star () {},
});

export default ListKBFocusView;
