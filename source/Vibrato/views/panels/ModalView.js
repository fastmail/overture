// -------------------------------------------------------------------------- \\
// File: ModalView.js                                                         \\
// Module: PanelViews                                                         \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ModalView = NS.Class({

    Extends: NS.View,

    className: 'ModalView',

    didCreateLayer: function ( layer ) {
        layer.set( 'style', Object.toCSSString({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: this.get( 'zIndex' )
        }) );
        return this;
    },

    positioning: 'absolute',
    layout: NS.View.LAYOUT_FILL_PARENT,
    zIndex: 5000,

    title: '',

    eventHandler: function () {
        return new NS.ModalEventHandler({ view: this });
    }.property(),

    didEnterDocument: function () {
        NS.ViewEventsController.pushEventTarget( this.get( 'eventHandler' ) );
        return ModalView.parent.didEnterDocument.call( this );
    },
    willLeaveDocument: function () {
        NS.ViewEventsController.removeEventTarget( this.get( 'eventHandler' ) );
        return ModalView.parent.willLeaveDocument.call( this );
    },

    draw: function ( layer ) {
        var el = NS.Element.create,
            container = this._container = el( 'div', {
                styles: this.get( 'layerStyles' )
            }, [
                el( 'h1', {
                    text: this.get( 'title' )
                })
            ]),
            children = this.get( 'childViews' );

        for ( var i = 0, l = children.length; i < l; i += 1 ) {
            container.appendChild( children[i].render().get( 'layer' ) );
        }

        layer.appendChild( container );
    },

    insertView: function ( view, relativeNode, where ) {
        if ( !relativeNode ) { relativeNode = this._container; }
        return ModalView.parent.insertView.call(
            this, view, relativeNode, where );
    },

    stopEvents: function ( event ) {
        event.stopPropagation();
    }.on( 'click', 'mousedown', 'mouseup',
        'keypress', 'keydown', 'keyup', 'tap' )
});

NS.ModalView = ModalView;

}( this.O ) );
