// -------------------------------------------------------------------------- \\
// File: NotificationView.js                                                  \\
// Module: View                                                               \\
// Requires: Core, Foundation, View.js                                        \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

var NotificationView = NS.Class({

    Extends: NS.View,

    Mixin: NS.AnimatableView,

    animateLayerDuration: 200,

    className: function () {
        return 'NotificationView' +
            ( this.get( 'userMayClose' ) ? ' closable' : '' );
    }.property( 'userMayClose' ),

    destroyOnClose: true,

    isShowing: false,
    userMayClose: true,
    precedence: 0,
    timeout: 0,

    text: '',
    html: '',

    show: function ( notificationsContainer ) {
        notificationsContainer.insertView( this );
        this.set( 'layout', {
            top: this.get( 'pxHeight' )
        });
        var timeout = this.get( 'timeout' );
        if ( timeout ) {
            NS.RunLoop.invokeAfterDelay( this.hide, timeout, this );
        }
        return this;
    },

    hide: function () {
        return this.set( 'layout', NotificationView.prototype.layout );
    },

    didAnimate: function () {
        if ( !this.get( 'layout' ).top ) {
            this.get( 'parentView' )
                .removeView( this )
                .notificationDidHide( this );

            if ( this.get( 'destroyOnClose' ) ) {
                this.destroy();
            }
        }
    },

    zIndex: 10000,
    layout: {
        top: 0
    },

    draw: function ( layer ) {
        this.drawNotification( layer );
        if ( this.get( 'userMayClose' ) ) {
            layer.appendChild(
                NS.Element.create( 'a.close', [
                    NS.loc( 'Close' )
                ])
            );
        }
    },

    drawNotification: function ( layer ) {
        var text = this.get( 'text' ),
            html = this.get( 'html' );
        if ( text || html ) {
            layer.appendChild(
                NS.Element.create( 'span', {
                    text: text || undefined,
                    html: text ? undefined : html
                })
            );
        }
    },

    hideOnClick: function ( event ) {
        if ( event.target.className === 'close' ) {
            event.preventDefault();
            this.hide();
        }
    }.on( 'click' )
});

var NotificationContainerView = NS.Class({

    Extends: NS.View,

    showing: null,

    init: function ( options ) {
        this._waiting = [];
        NotificationContainerView.parent.init.call( this, options );
    },

    positioning: 'absolute',
    layout: {
        bottom: '100%',
        left: '50%'
    },

    willShow: function ( notification ) {
        var showing = this.get( 'showing' );
        if ( showing ) {
            if ( notification !== showing &&
                    notification.get( 'precedence' ) >=
                    showing.get( 'precedence' ) ) {
                this._waiting.push( notification );
                this.hide( showing );
            }
            return false;
        }
        return true;
    },

    show: function ( notification ) {
        if ( this.willShow( notification ) ) {
            this.set( 'showing', notification );
            notification.show( this );
        }
    },

    hide: function ( notification ) {
        var showing = this.get( 'showing' );
        if ( showing && ( !notification || notification === showing ) ) {
            showing.hide();
        }
    },

    notificationDidHide: function ( notification ) {
        this.set( 'showing', null );
        var nextNotification = this._waiting.pop();
        if ( nextNotification ) {
            this.show( nextNotification );
        }
    }
});

NS.NotificationContainerView = NotificationContainerView;
NS.NotificationView = NotificationView;

}( this.O ) );
