// -------------------------------------------------------------------------- \\
// File: PopOverView.js                                                       \\
// Module: PanelViews                                                         \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var PopOverView = NS.Class({

    Extends: NS.View,

    className: 'PopOverView',

    positioning: 'absolute',

    isVisible: false,
    parentPopOverView: null,

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
    show: function ( options ) {
        if ( options.alignWithView === this ) {
            return this.get( 'subPopOverView' ).show( options );
        }
        this.hide();

        this._options = options;

        // Set layout and insert in the right place
        var eventHandler = this.get( 'eventHandler' ),
            view = options.view,
            alignWithView = options.alignWithView,
            atNode = options.atNode || alignWithView.get( 'layer' ),
            atNodeWidth = atNode.offsetWidth,
            atNodeHeight = atNode.offsetHeight,
            positionToThe = options.positionToThe || 'bottom',
            alignEdge = options.alignEdge || 'left',
            parent = options.inParent,
            deltaLeft = 0,
            deltaTop = 0,
            calloutDelta = 0,
            calloutIsAtTopOrBottom =
                ( positionToThe === 'top' || positionToThe === 'bottom' ),
            callout, layout, position, gap, layer,
            Element = NS.Element,
            el = Element.create,
            getPosition = Element.getPosition,
            RootView = NS.RootView,
            ScrollView = NS.ScrollView;

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
        layout = getPosition( atNode, parent instanceof ScrollView ?
            parent.get( 'scrollLayer' ) : parent.get( 'layer' ) );

        switch ( positionToThe ) {
        case 'right':
            layout.left += atNodeWidth;
            /* falls through */
        case 'left':
            switch ( alignEdge ) {
            // case 'top':
            //    break; // nothing to do
            case 'middle':
                atNodeHeight = atNodeHeight >> 1;
                /* falls through */
            case 'bottom':
                layout.top += atNodeHeight;
                break;
            }
            break;
        case 'bottom':
            layout.top += atNodeHeight;
            /* falls through */
        case 'top':
            switch ( alignEdge ) {
            // case 'left':
            //     break; // nothing to do
            case 'centre':
                atNodeWidth = atNodeWidth >> 1;
                /* falls through */
            case 'right':
                layout.left += atNodeWidth;
                break;
            }
            break;
        }

        layout.top += options.offsetTop || 0;
        layout.left += options.offsetLeft || 0;
        layout.zIndex = 1000;

        // Set layout
        this.set( 'layout', layout );

        // Insert view
        this.insertView( view );
        this.render();

        // Callout
        layer = this.get( 'layer' );
        if ( options.showCallout ) {
            layer.appendChild(
                el( 'b', {
                    className: 'callout ' +
                        positionToThe.charAt( 0 ) + ' ' + alignEdge
                }, [
                    callout = el( 'b', {
                        className: 'callout-inner ' + positionToThe.charAt( 0 )
                    })
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

        // Check not run off screen.
        position = getPosition( layer, parent.get( 'layer' ) );
        if ( parent instanceof RootView ||
                ( parent instanceof ScrollView &&
                !parent.get( 'showScrollbarX' ) ) ) {
            // Check left edge
            gap = position.left + deltaLeft;
            if ( gap < 0 ) {
                deltaLeft -= gap;
                deltaLeft += 10;
                if ( callout && calloutIsAtTopOrBottom ) {
                    calloutDelta -= gap;
                    calloutDelta += 10;
                }
            }
            // Check right edge
            gap = parent.get( 'pxWidth' ) - gap - layer.offsetWidth;
            // If gap is negative, move the view.
            if ( gap < 0 ) {
                deltaLeft += gap;
                deltaLeft -= 10;
                if ( callout && calloutIsAtTopOrBottom ) {
                    calloutDelta += gap;
                    calloutDelta -= 10;
                }
            }
        }
        if ( parent instanceof RootView ||
                ( parent instanceof ScrollView &&
                !parent.get( 'showScrollbarY' ) ) ) {
            // Check top edge
            gap = position.top + deltaTop;
            if ( gap < 0 ) {
                deltaTop -= gap;
                deltaTop += 10;
                if ( callout && !calloutIsAtTopOrBottom ) {
                    calloutDelta -= gap;
                    calloutDelta += 10;
                }
            }
            // Check bottom edge
            gap = parent.get( 'pxHeight' )  - gap - layer.offsetHeight;
            if ( gap < 0 ) {
                deltaTop += gap;
                deltaTop -= 10;
                if ( callout && !calloutIsAtTopOrBottom ) {
                    calloutDelta += gap;
                    calloutDelta -= 10;
                }
            }
        }

        if ( deltaLeft || deltaTop ) {
            layout.left += deltaLeft;
            layout.top += deltaTop;
            this.propertyDidChange( 'layout' );
        }
        if ( calloutDelta ) {
            Element.setStyle( callout,
                calloutIsAtTopOrBottom ? 'left' : 'top',
                -calloutDelta + 'px'
            );
        }

        if ( eventHandler ) {
            NS.ViewEventsController.addEventTarget( eventHandler, 10 );
        }
        this.set( 'isVisible', true );

        return this;
    },

    hide: function () {
        if ( this.get( 'isVisible' ) ) {
            var subPopOverView = this.hasSubView() ?
                    this.get( 'subPopOverView' ) : null,
                eventHandler = this.get( 'eventHandler' ),
                options = this._options,
                onHide, view, layer;
            if ( subPopOverView ) {
                subPopOverView.hide();
            }
            this.set( 'isVisible', false );
            view = this.get( 'childViews' )[0];
            this.get( 'parentView' ).removeView( this );
            this.removeView( view );
            if ( options.showCallout ) {
                layer = this.get( 'layer' );
                layer.removeChild( layer.firstChild );
            }
            if ( eventHandler ) {
                NS.ViewEventsController.removeEventTarget( eventHandler );
                eventHandler._seenMouseDown = false;
            }
            this._options = null;
            if ( onHide = options.onHide ) {
                onHide( options, this );
            }
        }
        return this;
    },

    hasSubView: function () {
        return !!NS.meta( this ).cache.subPopOverView &&
            this.get( 'subPopOverView' ).get( 'isVisible' );
    },

    subPopOverView: function () {
        return new NS.PopOverView({ parentPopOverView: this });
    }.property(),

    eventHandler: function () {
        return this.get( 'parentPopOverView' ) ?
            null : new NS.ModalEventHandler({ view: this });
    }.property(),

    clickedOutside: function () {
        this.hide();
    },

    keyOutside: function ( event ) {
        var view = this;
        while ( view.hasSubView() ) {
            view = view.get( 'subPopOverView' );
        }
        view.get( 'childViews' )[0].fire( event.type, event );
        if ( event.type === 'keydown' &&
                NS.DOMEvent.lookupKey( event ) === 'esc' ) {
            view.hide();
        }
    },

    stopEvents: function ( event ) {
        event.stopPropagation();
    }.on( 'click', 'mousedown', 'mouseup',
        'keypress', 'keydown', 'keyup', 'tap' )
});

NS.PopOverView = PopOverView;

}( this.O ) );
