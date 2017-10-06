import { Class, meta } from '../../core/Core';
import '../../foundation/EventTarget';  // For Function#on
import { lookupKey } from '../../dom/DOMEvent';
import Element from '../../dom/Element';
import RootView from '../RootView';
import View from '../View';
import ViewEventsController from '../ViewEventsController';
import ScrollView from '../containers/ScrollView';

import ModalEventHandler from './ModalEventHandler';

const PopOverView = Class({

    Extends: View,

    className: 'v-PopOver',

    positioning: 'absolute',

    isVisible: false,
    parentPopOverView: null,

    ariaAttributes: {
        modal: 'true',
    },

    /*
        Options
        - view -> The view to append to the pop over
        - alignWithView -> the view to align to
        - atNode -> the node within the view to align to
        - positionToThe -> 'bottom'/'top'/'left'/'right'
        - alignEdge -> 'left'/'centre'/'right'/'top'/'middle'/'bottom'
        - inParent -> The view to insert the pop over in (optional)
        - showCallout -> true/false
        - offsetLeft
        - offsetTop
        - onHide: fn
    */
    show ( options ) {
        if ( options.alignWithView === this ) {
            return this.get( 'subPopOverView' ).show( options );
        }
        this.hide();

        this._options = options;

        // Set layout and insert in the right place
        const eventHandler = this.get( 'eventHandler' );
        const view = options.view;
        const alignWithView = options.alignWithView;
        const atNode = options.atNode || alignWithView.get( 'layer' );
        let atNodeWidth = atNode.offsetWidth;
        let atNodeHeight = atNode.offsetHeight;
        const positionToThe = options.positionToThe || 'bottom';
        const alignEdge = options.alignEdge || 'left';
        let parent = options.inParent;
        let deltaLeft = 0;
        let deltaTop = 0;
        const el = Element.create;

        // Want nearest parent scroll view (or root view if none).
        // Special case parent == parent pop-over view.
        if ( !parent ) {
            parent = options.atNode ?
                alignWithView : alignWithView.get( 'parentView' );
            while ( !( parent instanceof RootView ) &&
                    !( parent instanceof ScrollView ) &&
                    !( parent instanceof PopOverView ) ) {
                parent = parent.get( 'parentView' );
            }
        }

        // Now find out our offsets;
        const position = Element.getPosition( atNode, parent.get(
            parent instanceof ScrollView ? 'scrollLayer' : 'layer' ) );
        let top = position.top;
        let left = position.left;

        switch ( positionToThe ) {
        case 'right':
            left += atNodeWidth;
            /* falls through */
        case 'left':
            switch ( alignEdge ) {
            // case 'top':
            //    break; // nothing to do
            case 'middle':
                atNodeHeight = atNodeHeight >> 1;
                /* falls through */
            case 'bottom':
                top += atNodeHeight;
                break;
            }
            break;
        case 'bottom':
            top += atNodeHeight;
            /* falls through */
        case 'top':
            switch ( alignEdge ) {
            // case 'left':
            //     break; // nothing to do
            case 'centre':
                atNodeWidth = atNodeWidth >> 1;
                /* falls through */
            case 'right':
                left += atNodeWidth;
                break;
            }
            break;
        }

        top += options.offsetTop || 0;
        left += options.offsetLeft || 0;

        // Round values to prevent buggy callout rendering.
        top = Math.round( top );
        left = Math.round( left );

        // Set layout
        this.set( 'layout', {
            top: 0,
            left: 0,
            transform: 'translate(' +
                ( left + deltaLeft ) + 'px,' +
                ( top + deltaTop ) + 'px' +
            ')',
        });

        // Insert view
        this.insertView( view );
        this.render();

        // Callout
        const layer = this.get( 'layer' );
        if ( options.showCallout ) {
            layer.appendChild(
                el( 'b', {
                    className: 'v-PopOver-callout' +
                        ' v-PopOver-callout--' + positionToThe.charAt( 0 ) +
                        ' v-PopOver-callout--' + alignEdge,
                }, [
                    this._callout = el( 'b', {
                        className: 'v-PopOver-triangle' +
                            ' v-PopOver-triangle--' + positionToThe.charAt( 0 ),
                    }),
                ])
            );
        }

        // Insert into parent.
        parent.insertView( this );

        // Adjust positioning
        switch ( positionToThe ) {
        case 'left':
            deltaLeft -= layer.offsetWidth;
            /* falls through */
        case 'right':
            switch ( alignEdge ) {
            // case 'top':
            //    break; // nothing to do
            case 'middle':
                deltaTop -= layer.offsetHeight >> 1;
                break;
            case 'bottom':
                deltaTop -= layer.offsetHeight;
                break;
            }
            break;
        case 'top':
            deltaTop -= layer.offsetHeight;
            /* falls through */
        case 'bottom':
            switch ( alignEdge ) {
            // case 'left':
            //     break; // nothing to do
            case 'centre':
                deltaLeft -= layer.offsetWidth >> 1;
                break;
            case 'right':
                deltaLeft -= layer.offsetWidth;
                break;
            }
            break;
        }

        this.adjustPosition( deltaLeft, deltaTop );

        if ( eventHandler ) {
            ViewEventsController.addEventTarget( eventHandler, 10 );
        }
        this.set( 'isVisible', true );

        return this;
    },

    /**
        Property: O.PopOverView#parentMargin
        Type: {top: number, left: number, right: number, bottom: number}

        The popover will ensure that it is at least N pixels away from each edge
        of the parent view.
    */
    parentMargin: {
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
    },

    adjustPosition ( deltaLeft, deltaTop ) {
        let parent = this.get( 'parentView' );
        const layer = this.get( 'layer' );
        const positionToThe = this._options.positionToThe || 'bottom';
        const callout = this._callout;
        const calloutIsAtTopOrBottom =
                ( positionToThe === 'top' || positionToThe === 'bottom' );
        const parentMargin = this.get( 'parentMargin' );

        if ( !deltaLeft ) { deltaLeft = 0; }
        if ( !deltaTop ) { deltaTop = 0; }

        // Check not run off screen.
        if ( parent instanceof PopOverView ) {
            parent = parent.getParent( ScrollView ) ||
                parent.getParent( RootView );
        }
        const position = Element.getPosition( layer, parent.get( 'layer' ) );
        let gap;
        let calloutDelta = 0;

        // Check right edge
        if ( !parent.get( 'showScrollbarX' ) ) {
            gap = parent.get( 'pxWidth' ) - position.left - deltaLeft -
                layer.offsetWidth;
            // If gap is negative, move the view.
            if ( gap < 0 ) {
                deltaLeft += gap;
                deltaLeft -= parentMargin.right;
                if ( callout && calloutIsAtTopOrBottom ) {
                    calloutDelta += gap;
                    calloutDelta -= parentMargin.right;
                }
            }
        }

        // Check left edge
        gap = position.left + deltaLeft;
        if ( gap < 0 ) {
            deltaLeft -= gap;
            deltaLeft += parentMargin.left;
            if ( callout && calloutIsAtTopOrBottom ) {
                calloutDelta -= gap;
                calloutDelta += parentMargin.left;
            }
        }

        // Check bottom edge
        if ( !parent.get( 'showScrollbarY' ) ) {
            gap = parent.get( 'pxHeight' ) - position.top - deltaTop -
                layer.offsetHeight;
            if ( gap < 0 ) {
                deltaTop += gap;
                deltaTop -= parentMargin.bottom;
                if ( callout && !calloutIsAtTopOrBottom ) {
                    calloutDelta += gap;
                    calloutDelta -= parentMargin.bottom;
                }
            }
        }

        // Check top edge
        gap = position.top + deltaTop;
        if ( gap < 0 ) {
            deltaTop -= gap;
            deltaTop += parentMargin.top;
            if ( callout && !calloutIsAtTopOrBottom ) {
                calloutDelta -= gap;
                calloutDelta += parentMargin.top;
            }
        }

        if ( deltaLeft || deltaTop ) {
            const transform = this.get( 'layout' ).transform
                    .slice( 10, -1 )
                    .split( ',' );
            const left = parseInt( transform[0], 10 );
            const top = parseInt( transform[1], 10 );
            // Redraw immediately to prevent "flashing"
            this.set( 'layout', {
                top: 0,
                left: 0,
                transform: 'translate(' +
                    ( left + deltaLeft ) + 'px,' +
                    ( top + deltaTop ) + 'px' +
                ')',
            }).redraw();
        }
        if ( calloutDelta ) {
            Element.setStyle( callout,
                calloutIsAtTopOrBottom ? 'left' : 'top',
                -calloutDelta + 'px'
            );
        }
    },

    didLeaveDocument () {
        PopOverView.parent.didLeaveDocument.call( this );
        this.hide();
        return this;
    },

    hide () {
        if ( this.get( 'isVisible' ) ) {
            const subPopOverView = this.hasSubView() ?
                    this.get( 'subPopOverView' ) : null;
            const eventHandler = this.get( 'eventHandler' );
            const options = this._options;
            let onHide, layer;
            if ( subPopOverView ) {
                subPopOverView.hide();
            }
            this.set( 'isVisible', false );
            const view = this.get( 'childViews' )[0];
            this.detach();
            this.removeView( view );
            if ( options.showCallout ) {
                layer = this.get( 'layer' );
                layer.removeChild( layer.firstChild );
                this._callout = null;
            }
            if ( eventHandler ) {
                ViewEventsController.removeEventTarget( eventHandler );
                eventHandler._seenMouseDown = false;
            }
            this._options = null;
            if ( onHide = options.onHide ) {
                onHide( options, this );
            }
        }
        return this;
    },

    hasSubView () {
        return !!meta( this ).cache.subPopOverView &&
            this.get( 'subPopOverView' ).get( 'isVisible' );
    },

    subPopOverView: function () {
        return new PopOverView({ parentPopOverView: this });
    }.property(),

    eventHandler: function () {
        return this.get( 'parentPopOverView' ) ?
            null : new ModalEventHandler({ view: this });
    }.property(),

    clickedOutside () {
        this.hide();
    },

    keyOutside ( event ) {
        let view = this;
        while ( view.hasSubView() ) {
            view = view.get( 'subPopOverView' );
        }
        view.get( 'childViews' )[0].fire( event.type, event );
        if ( event.type === 'keydown' ) {
            view.closeOnEsc( event );
        }
    },

    closeOnEsc: function ( event ) {
        if ( lookupKey( event ) === 'esc' ) {
            this.hide();
        }
    }.on( 'keydown' ),

    stopEvents: function ( event ) {
        event.stopPropagation();
    }.on( 'click', 'mousedown', 'mouseup',
        'keypress', 'keydown', 'keyup', 'tap' ),
});

export default PopOverView;
