// -------------------------------------------------------------------------- \\
// File: PopOverView.js                                                       \\
// Module: PanelViews                                                         \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
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
            position, layer;

        // Want nearest parent scroll view (or root view if none).
        // Special case parent == parent pop-over view.
        if ( !parent ) {
            parent = options.atNode ?
                alignWithView : alignWithView.get( 'parentView' );
            while ( !( parent instanceof NS.RootView ) &&
                    !( parent instanceof NS.ScrollView ) &&
                    !( parent instanceof PopOverView ) ) {
                parent = parent.get( 'parentView' );
            }
        }

        // Now find out our offsets;
        position = NS.Element.getPosition( atNode, parent.get( 'layer' ) );

        switch ( positionToThe ) {
        case 'right':
            position.left += atNodeWidth;
            /* falls through */
        case 'left':
            switch ( alignEdge ) {
            // case 'top':
            //    break; // nothing to do
            case 'middle':
                atNodeHeight = atNodeHeight >> 1;
                /* falls through */
            case 'bottom':
                position.top += atNodeHeight;
                break;
            }
            break;
        case 'bottom':
            position.top += atNodeHeight;
            /* falls through */
        case 'top':
            switch ( alignEdge ) {
            // case 'left':
            //     break; // nothing to do
            case 'centre':
                atNodeWidth = atNodeWidth >> 1;
                /* falls through */
            case 'right':
                position.left += atNodeWidth;
                break;
            }
            break;
        }

        position.top += options.offsetTop || 0;
        position.left += options.offsetLeft || 0;
        position.zIndex = 1000;

        // Set layout
        this.set( 'layout', position );

        // Insert view
        this.insertView( view );
        this.render();

        // Callout
        layer = this.get( 'layer' );
        if ( options.showCallout ) {
            layer.appendChild(
                NS.Element.create( 'b', {
                    className: 'callout ' +
                        positionToThe.charAt( 0 ) + ' ' + alignEdge
                })
            );
        }

        // Insert into parent.
        parent.insertView( this );

        // Adjust positioning
        switch ( positionToThe ) {
        case 'left':
            position.left -= layer.offsetWidth;
            /* falls through */
        case 'right':
            switch ( alignEdge ) {
            // case 'top':
            //    break; // nothing to do
            case 'middle':
                position.top -= layer.offsetHeight >> 1;
                break;
            case 'bottom':
                position.top -= layer.offsetHeight;
                break;
            }
            break;
        case 'top':
            position.top -= layer.offsetHeight;
            /* falls through */
        case 'bottom':
            switch ( alignEdge ) {
            // case 'left':
            //     break; // nothing to do
            case 'centre':
                position.left -= layer.offsetWidth >> 1;
                break;
            case 'right':
                position.left -= layer.offsetWidth;
                break;
            }
            break;
        }
        if ( positionToThe === 'left' || positionToThe === 'top' ||
                ( alignEdge !== 'left' && alignEdge !== 'top' ) ) {
            this.propertyDidChange( 'layout' );
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
            view = options.view;
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
                onHide();
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
        view._options.view.fire( event.type, event );
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
