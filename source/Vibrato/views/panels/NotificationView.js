// -------------------------------------------------------------------------- \\
// File: NotificationView.js                                                  \\
// Module: View                                                               \\
// Requires: Core, Foundation, View.js                                        \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document, location */

"use strict";

( function ( NS ) {

var idPrefix = 'notification' + Date.now() + '-',
    counter = 0;

var NotificationView = NS.Class({

    Extends: NS.View,

    _current: 0,

    isShowing: false,

    positioning: 'absolute',

    className: function () {
        return 'NotificationView' +
            ( this.get( 'isShowing' ) ? ' isShowing' : '' );
    }.property( 'isShowing' ),

    draw: function ( layer ) {
        layer.appendChild( this._container = NS.Element.create( 'p' ) );
    },

    show: function ( message, time, isUserClosable ) {
        var el = NS.Element.create,
            container = el( 'p' ),
            actions = this._actions = {},
            count = ( counter += 1 ),
            doc = document,
            i, l, part, id;

        if ( !( message instanceof Array ) ) {
            message = [ message ];
        }

        for ( i = 0, l = message.length; i < l; i += 1 ) {
            part = message[i];
            if ( typeof part === 'string' ) {
                container.appendChild( doc.createTextNode( part ) );
            } else {
                id = idPrefix + count + i;
                container.appendChild( el( 'a', {
                    id: id,
                    href: location.href,
                    text: part.text
                }) );
                actions[ id ] = part;
            }
        }

        if ( isUserClosable ) {
            container.appendChild(
                this._close = el( 'a.close', [
                    NS.loc( 'Close' )
                ])
            );
        }

        this.get( 'layer' ).replaceChild( container, this._container );
        this._container = container;
        this.set( 'isShowing', true );

        if ( time ) {
            NS.RunLoop.invokeAfterDelay( function () {
                this.hide( count );
            }, time, this );
        }

        return ( this._current = count );
    },

    hide: function ( id ) {
        if ( id === this._current && this.get( 'isShowing' ) ) {
            this.set( 'isShowing', false );
            this._actions = null;
            this._close = null;
        }
    },

    _triggerAction: function ( event ) {
        var target = event.target,
            id = target.id,
            action = this._actions && this._actions[ id ];
        if ( target === this._close ) {
            this.hide( this._current );
        }
        else if ( action ) {
            event.preventDefault();
            action.object[ action.method ]();
        }
    }.on( 'click' )
});

NS.NotificationView = NotificationView;

}( this.O ) );
