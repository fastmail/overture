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
    
    layerTag: 'label',
    
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
    
    _domControl: null,
    _domLabel: null,
    
    label: '',
    value: false,
    shortcut: '',
    disabled: false,
    
    tooltip: function () {
        var shortcut = this.get( 'shortcut' );
        return shortcut ? NS.loc( 'Shortcut: [_1]', shortcut ) : '';
    }.property( 'shortcut' ),
    
    activate: function () {},
    
    // --- Focus ---
    
    focus: function () {
        var control = this._domControl;
        if ( control ) { control.focus(); }
        return this;
    },
    
    blur: function () {
        var control = this._domControl;
        if ( control ) { control.blur(); }
        return this;
    },
    
    // --- Keep render in sync with state ---
    
    labelDidChange: function () {
        if ( this.get( 'isRendered' ) ) {
            this._domLabel.textContent = this.get( 'label' );
        }
    }.observes( 'label' ),
    
    disabledDidChange: function () {
        if ( this.get( 'isRendered' ) ) {
            this._domControl.disabled = this.get( 'disabled' );
        }
    }.observes( 'disabled' ),
    
    tooltipDidChange: function () {
        if ( this.get( 'isRendered' ) ) {
            this.get( 'layer' ).title = this.get( 'tooltip' );
        }
    }.observes( 'tooltip' )
});

NS.AbstractControlView = AbstractControlView;

}( this.O ) );