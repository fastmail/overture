// -------------------------------------------------------------------------- \\
// File: ModalView.js                                                         \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ModalViewEventHandler = NS.Class({

    Extends: NS.Object,

    stopKeyPropagation: function ( event ) {
        if ( event.phase === 'views' || !NS.Element.contains(
                this._view.get( 'layer' ), event.target ) ) {
            event.stopPropagation();
        }
    }.on( 'keypress' )
});

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
        return new ModalViewEventHandler({ _view: this });
    }.property(),

    nextEventTarget: function () {
        return this.get( 'eventHandler' );
    }.property(),

    didAppendLayerToDocument: function () {
        NS.RootViewController.pushResponder( this.get( 'eventHandler' ) );
        return ModalView.parent.didAppendLayerToDocument.call( this );
    },
    willRemoveLayerFromDocument: function () {
        NS.RootViewController.removeResponder( this.get( 'eventHandler' ) );
        return ModalView.parent.willRemoveLayerFromDocument.call( this );
    },

    _render: function ( layer ) {
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
    }
});

NS.ModalView = ModalView;

}( this.O ) );
