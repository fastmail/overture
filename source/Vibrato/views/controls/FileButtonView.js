// -------------------------------------------------------------------------- \\
// File: FileButtonView.js                                                    \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, IO, AbstractControlView.js                \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global FormData */

"use strict";

( function ( NS, undefined ) {

var canUseMultiple = FormData.isFake ? null : 'multiple';

var FileButtonView = NS.Class({

    Extends: NS.AbstractControlView,

    acceptMultiple: false,
    acceptOnlyTypes: '',

    type: '',
    icon: '',

    tabIndex: -1,

    // --- Render ---

    className: function () {
        var type = this.get( 'type' );
        return 'ButtonView FileButtonView' +
            ( type ? ' ' + type : '' ) +
            ( this.get( 'isDisabled' ) ? ' disabled' : '' );
    }.property( 'type', 'isDisabled' ),

    draw: function ( layer ) {
        var Element = NS.Element,
            el = Element.create,
            icon = this.get( 'icon' );

        Element.appendChildren( layer, [
            icon ? el( 'i', {
                className: icon
            }) : null,
            this._domControl = el( 'input', {
                type: 'file',
                accept: this.get( 'acceptOnlyTypes' ) || undefined,
                multiple: this.get( 'acceptMultiple' ) && canUseMultiple
            })
        ]);
        FileButtonView.parent.draw.call( this, layer );
    },

    // --- Keep render in sync with state ---

    propertyNeedsRedraw: function () {
        return FileButtonView.parent
            .propertyNeedsRedraw.apply( this, arguments );
    }.observes( 'className', 'layerStyles',
        'isDisabled', 'label', 'tooltip', 'tabIndex',
        'icon' ),

    redrawIcon: function ( layer ) {
        layer.firstChild.className = this.get( 'icon' );
    },

    // --- Activate ---

    target: null,
    action: null,
    method: '',

    activate: function ( files ) {
        if ( !this.get( 'isDisabled' ) ) {
            var target = this.get( 'target' ) || this,
                action;
            if ( action = this.get( 'action' ) ) {
                target.fire( action, {
                    originView: this,
                    files: files
                });
            } else if ( action = this.get( 'method' ) ) {
                target[ action ]( files, this );
            }
            this.fire( 'button:activate' );
        }
    },

    _fileWasChosen: function ( event ) {
        var input = this._domControl,
            files, filePath;
        if ( event.target === input ) {
            input.parentNode.replaceChild(
                this._domControl = NS.Element.create( 'input', {
                    type: 'file',
                    disabled: this.get( 'isDisabled' ),
                    tabIndex: this.get( 'tabIndex' ),
                    accept: this.get( 'acceptOnlyTypes' ) || undefined,
                    multiple: this.get( 'acceptMultiple' ) && canUseMultiple
                }), input );
            if ( !FormData.isFake && input.files ) {
                files = Array.prototype.slice.call( input.files );
            } else {
                filePath = input.value.replace( /\\/g, '/' );
                files = [{
                    name: filePath.slice( filePath.lastIndexOf( '/' ) + 1 ),
                    size: 0,
                    type: '',
                    file: input
                }];
            }
            this.activate( files );
        }
    }.on( 'change' )
});

NS.FileButtonView = FileButtonView;

}( this.O ) );
