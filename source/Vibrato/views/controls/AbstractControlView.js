// -------------------------------------------------------------------------- \\
// File: AbstractControlView.js                                               \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

var AbstractControlView = NS.Class({

    Extends: NS.View,

    isDisabled: false,

    label: '',
    value: false,
    tabIndex: undefined,

    shortcut: '',

    tooltip: function () {
        var shortcut = this.get( 'shortcut' );
        return shortcut ?
            NS.loc( 'Shortcut: [_1]',
                shortcut.split( ' ' ).join( ' ' + NS.loc( 'or' ) + ' ' )
            ) : '';
    }.property( 'shortcut' ),

    didAppendLayerToDocument: function () {
        var shortcut = this.get( 'shortcut' );
        if ( shortcut ) {
            shortcut.split( ' ' ).forEach( function ( key ) {
                NS.RootViewController.kbShortcuts
                    .register( key, this, 'activate' );
            }, this );
        }
        return AbstractControlView.parent.didAppendLayerToDocument.call( this );
    },
    willRemoveLayerFromDocument: function () {
        var shortcut = this.get( 'shortcut' );
        if ( shortcut ) {
            shortcut.split( ' ' ).forEach( function ( key ) {
                NS.RootViewController.kbShortcuts
                    .deregister( key, this, 'activate' );
            }, this );
        }
        return AbstractControlView.parent.willRemoveLayerFromDocument.call(
            this );
    },

    layerTag: 'label',

    _domControl: null,
    _domLabel: null,

    draw: function ( layer ) {
        var Element = NS.Element,
            el = Element.create,
            control = this._domControl,
            shortcut = this.get( 'shortcut' ),
            tabIndex = this.get( 'tabIndex' );

        control.disabled = this.get( 'isDisabled' );
        
        if ( tabIndex !== undefined ) {
            control.tabIndex = tabIndex;
        }

        if ( shortcut && ( /^\w$/.test( shortcut ) ) ) {
            control.accessKey = shortcut;
        }

        Element.appendChildren( layer, [
            this._domLabel = el( 'span', [ this.get( 'label' ) ] )
        ]);
        layer.title = this.get( 'tooltip' );
    },

    // --- Keep render in sync with state ---

    redrawIsDisabled: function ( layer ) {
        this._domControl.disabled = this.get( 'isDisabled' );
    },

    redrawLabel: function () {
        var label = this._domLabel,
            child;
        while ( child = label.firstChild ) {
            label.removeChild( child );
        }
        NS.Element.appendChildren( label, [
            this.get( 'label' )
        ]);
    },

    redrawTooltip: function ( layer ) {
        layer.title = this.get( 'tooltip' );
    },

    redrawTabIndex: function () {
        this._domControl.tabIndex = this.get( 'tabIndex' );
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
            this._domControl.blur();
        }
        return this;
    },

    // --- Activate ---

    activate: function () {}

});

NS.AbstractControlView = AbstractControlView;

}( this.O ) );
