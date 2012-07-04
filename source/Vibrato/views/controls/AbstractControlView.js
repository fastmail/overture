// -------------------------------------------------------------------------- \\
// File: AbstractControlView.js                                               \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var AbstractControlView = NS.Class({

    Extends: NS.View,

    isDisabled: false,

    label: '',
    value: false,

    shortcut: '',

    tooltip: function () {
        var shortcut = this.get( 'shortcut' );
        return shortcut ? NS.loc( 'Shortcut: [_1]', shortcut ) : '';
    }.property( 'shortcut' ),

    didAppendLayerToDocument: function () {
        var key = this.get( 'shortcut' );
        if ( key ) {
            NS.RootViewController.kbShortcuts
                .register( key, this, 'activate' );
        }
        return AbstractControlView.parent.didAppendLayerToDocument.call( this );
    },
    willRemoveLayerFromDocument: function () {
        var key = this.get( 'shortcut' );
        if ( key ) {
            NS.RootViewController.kbShortcuts
                .deregister( key, this, 'activate' );
        }
        return AbstractControlView.parent.willRemoveLayerFromDocument.call(
            this );
    },

    layerTag: 'label',

    _domControl: null,

    _render: function ( layer ) {
        var Element = NS.Element,
            el = Element.create;
        this._domControl.disabled = this.get( 'isDisabled' );
        Element.appendChildren( layer, [
            this._domLabel = el( 'span', [ this.get( 'label' ) ] )
        ]);
        layer.title = this.get( 'tooltip' );
    },

    // --- Focus ---

    focus: function () {
        if ( this.get( 'isInDocument' ) ) {
            this._domControl.focus();
        }
        return this;
    },

    blur: function () {
        if ( this.get( 'isInDocument' ) ) {
            this._domControl.focus();
        }
        return this;
    },

    // --- Activate ---

    activate: function () {},

    // --- Keep render in sync with state ---

    syncIsDisabled: function () {
        if ( this.get( 'isRendered' ) ) {
            this._domControl.disabled = this.get( 'isDisabled' );
        }
    }.observes( 'isDisabled' ),

    syncLabel: function () {
        if ( this.get( 'isRendered' ) ) {
            var label = this._domLabel,
                child;
            while ( child = label.firstChild ) {
                label.removeChild( child );
            }
            NS.Element.appendChildren( label, [
                this.get( 'label' )
            ]);
        }
    }.observes( 'label' ),

    syncTooltip: function () {
        if ( this.get( 'isRendered' ) ) {
            this.get( 'layer' ).title = this.get( 'tooltip' );
        }
    }.observes( 'tooltip' )
});

NS.AbstractControlView = AbstractControlView;

}( this.O ) );
