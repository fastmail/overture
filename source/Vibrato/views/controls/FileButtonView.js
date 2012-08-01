// -------------------------------------------------------------------------- \\
// File: FileButtonView.js                                                    \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, IO, AbstractControlView.js                \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global FormData */

"use strict";

( function ( NS ) {

var canUseMultiple = FormData.isFake ? null : 'multiple';

var FileButtonView = NS.Class({

    Extends: NS.AbstractControlView,

    acceptMultiple: false,

    type: '',
    icon: '',

    // --- Render ---

    className: function () {
        var type = this.get( 'type' );
        return 'ButtonView FileButtonView' +
            ( type ? ' ' + type : '' ) +
            ( this.get( 'isDisabled' ) ? ' disabled' : '' );
    }.property( 'type', 'isDisabled' ),

    _render: function ( layer ) {
        var Element = NS.Element,
            el = Element.create,
            icon = this.get( 'icon' );

        Element.appendChildren( layer, [
            icon ? el( 'i', {
                className: icon
            }) : null,
            this._domControl = el( 'input', {
                type: 'file',
                tabIndex: -1,
                multiple: this.get( 'acceptMultiple' ) && canUseMultiple
            })
        ]);
        FileButtonView.parent._render.call( this, layer );
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
                    tabIndex: -1,
                    multiple: this.get( 'acceptMultiple' ) && canUseMultiple
                }), input );
            if ( input.files ) {
                files = Array.prototype.slice.call( input.files );
            } else {
                filePath = input.value.replace( /\\/g, '/' );
                files = [{
                    name: filePath.slice( filePath.lastIndexOf( '/' ) + 1 ),
                    size: 0,
                    file: input
                }];
            }
            this.activate( files );
        }
    }.on( 'change' ),

    // --- Keep render in sync with state ---

    syncIcon: function () {
        if ( this.get( 'isRendered' ) ) {
            this.get( 'layer' ).firstChild.className = this.get( 'icon' );
        }
    }.observes( 'icon' )
});

NS.FileButtonView = FileButtonView;

}( this.O ) );
