// -------------------------------------------------------------------------- \\
// File: NotificationView.js                                                  \\
// Module: PanelViews                                                         \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

var hiddenLayout = {
    top: 0
};

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

    hiddenLayout: hiddenLayout,
    visibleLayout: function () {
        return {
            top: -this.get( 'pxHeight' ) - 10
        };
    }.property(),

    text: '',
    html: '',

    _timer: null,

    show: function ( notificationsContainer ) {
        if ( this.get( 'isShowing' ) ) {
            this.hide( true );
        }
        notificationsContainer.insertView( this );
        this._show();
        var timeout = this.get( 'timeout' );
        if ( timeout ) {
            this._timer =
                NS.RunLoop.invokeAfterDelay( this.hide, timeout, this );
        }
        return this.set( 'isShowing', true );
    },

    _show: function () {
        if ( this.get( 'isShowing' ) ) {
            this.set( 'layout',  this.get( 'visibleLayout' ) );
        }
    }.later(),

    hide: function ( doNotAnimate ) {
        if ( this.get( 'isShowing' ) ) {
            // If we don't have a layerAnimation object yet, we can't have
            // animated in, so just detach immediately. Otherwise, stop the
            // current layer animation, then animate out.
            var layerAnimation = NS.meta( this ).cache.layerAnimation,
                hiddenLayout = this.get( 'hiddenLayout' );
            if ( !doNotAnimate && layerAnimation &&
                    this.get( 'layout' ) !== hiddenLayout ) {
                layerAnimation.stop();
                this.set( 'layout', hiddenLayout );
            } else {
                this.detach();
            }
            if ( this._timer ) {
                NS.RunLoop.cancel( this._timer );
                this._timer = null;
            }
            this.set( 'isShowing', false );
        }
        return this;
    },

    didAnimate: function () {
        this.increment( 'animating', -1 );
        if ( !this.get( 'animating' ) && !this.get( 'isShowing' ) ) {
            this.detach();
        }
    },

    detach: function () {
        this.get( 'parentView' )
            .removeView( this )
            .notificationDidHide( this );

        if ( this.get( 'destroyOnClose' ) ) {
            this.destroy();
        }
        return this;
    },

    layout: hiddenLayout,

    draw: function ( layer ) {
        this.drawNotification( layer );
        if ( this.get( 'userMayClose' ) ) {
            var el = NS.Element.create;
            layer.appendChild(
                this._close = el( 'a.close', [
                    el( 'i.icon.icon-close' ),
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
                this._textNode = NS.Element.create( 'span', {
                    text: text || undefined,
                    html: text ? undefined : html
                })
            );
        }
    },

    notificationNeedsRedraw: function ( self, property, oldValue ) {
       return this.propertyNeedsRedraw( self, property, oldValue );
    }.observes( 'text', 'html' ),

    redrawText: function () {
        this.redrawHTML();
    },
    redrawHTML: function () {
        var text = this.get( 'text' ),
            html = this.get( 'html' );
        this._textNode.set( html ? 'html' : 'text', html || text );
    },

    hideOnClick: function ( event ) {
        if ( this.get( 'userMayClose' ) &&
                NS.Element.contains( this._close, event.target ) ) {
            event.preventDefault();
            this.hide();
        }
    }.on( 'click' )
});

var NotificationContainerView = NS.Class({

    Extends: NS.View,

    className: 'NotificationContainerView',

    showing: null,

    init: function ( mixin ) {
        this._waiting = [];
        NotificationContainerView.parent.init.call( this, mixin );
    },

    positioning: 'absolute',

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
