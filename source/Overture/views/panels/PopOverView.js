// -------------------------------------------------------------------------- \\
// File: PopOverView.js                                                       \\
// Module: PanelViews                                                         \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var PopOverView = NS.Class({

    Extends: NS.View,

    className: 'v-PopOver',

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
            layout, layer,
            Element = NS.Element,
            el = Element.create,
            RootView = NS.RootView,
            ScrollView = NS.ScrollView,
            prop;

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
        layout = Element.getPosition( atNode, parent instanceof ScrollView ?
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

        // Round values to prevent buggy callout rendering.
        for ( prop in layout ) {
            layout[ prop ] = Math.round( layout[prop] );
        }

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
                    className: 'v-PopOver-callout' +
                        ' v-PopOver-callout--' + positionToThe.charAt( 0 ) +
                        ' v-PopOver-callout--' + alignEdge
                }, [
                    this._callout = el( 'b', {
                        className: 'v-PopOver-triangle' +
                            ' v-PopOver-triangle--' + positionToThe.charAt( 0 )
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

        this.adjustPosition( deltaLeft, deltaTop );

        if ( eventHandler ) {
            NS.ViewEventsController.addEventTarget( eventHandler, 10 );
        }
        this.set( 'isVisible', true );

        return this;
    },

    adjustPosition: function ( deltaLeft, deltaTop ) {
        var Element = NS.Element,
            parent = this.get( 'parentView' ),
            layer = this.get( 'layer' ),
            layout = this.get( 'layout' ),
            positionToThe = this._options.positionToThe || 'bottom',
            callout = this._callout,
            calloutDelta = 0,
            calloutIsAtTopOrBottom =
                ( positionToThe === 'top' || positionToThe === 'bottom' ),
            position, gap;

        if ( !deltaLeft ) { deltaLeft = 0; }
        if ( !deltaTop ) { deltaTop = 0; }

        // Check not run off screen.
        if ( parent instanceof PopOverView ) {
            parent = parent.getParent( NS.ScrollView ) ||
                parent.getParent( NS.RootView );
        }
        position = Element.getPosition( layer, parent.get( 'layer' ) );

        // Check right edge
        if ( !parent.get( 'showScrollbarX' ) ) {
            gap = parent.get( 'pxWidth' ) - position.left - deltaLeft -
                layer.offsetWidth;
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

        // Check bottom edge
        if ( !parent.get( 'showScrollbarY' ) ) {
            gap = parent.get( 'pxHeight' )  - position.top - deltaTop -
                layer.offsetHeight;
            if ( gap < 0 ) {
                deltaTop += gap;
                deltaTop -= 10;
                if ( callout && !calloutIsAtTopOrBottom ) {
                    calloutDelta += gap;
                    calloutDelta -= 10;
                }
            }
        }

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

        if ( deltaLeft || deltaTop ) {
            // Redraw immediately to prevent "flashing"
            this.set( 'layout', {
                top: layout.top + deltaTop,
                left: layout.left + deltaLeft
            }).redraw();
        }
        if ( calloutDelta ) {
            Element.setStyle( callout,
                calloutIsAtTopOrBottom ? 'left' : 'top',
                -calloutDelta + 'px'
            );
        }
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
                this._callout = null;
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
        if ( event.type === 'keydown' ) {
            view.closeOnEsc( event );
        }
    },

    closeOnEsc: function ( event ) {
        if ( NS.DOMEvent.lookupKey( event ) === 'esc' ) {
            this.hide();
        }
    }.on( 'keydown' ),

    stopEvents: function ( event ) {
        event.stopPropagation();
    }.on( 'click', 'mousedown', 'mouseup',
        'keypress', 'keydown', 'keyup', 'tap' )
});

NS.PopOverView = PopOverView;

}( this.O ) );
