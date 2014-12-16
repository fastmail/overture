// -------------------------------------------------------------------------- \\
// File: FileButtonView.js                                                    \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, ButtonView.js                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

/*global FormData */

"use strict";

( function ( NS, undefined ) {

var canUseMultiple = FormData.isFake ? null : 'multiple';

/**
    Class: O.FileButtonView

    Extends: O.ButtonView

    A FileButtonView is used to allow the user to select a file (or multiple
    files) from their computer, which you can then upload to a server or, on
    modern browsers, read and manipulate directly.

    In general, FileButtonview is designed to be used just like an
    <O.ButtonView> instance, including styling.

    ### Styling O.FileButtonView ###

    The underlying DOM structure is:

        <label>
            <i class="${view.icon}"></i>
            <input type="file">
            <span>${view.label}</span>
        </label>

    If there is no icon property set, the <i> will have a class of 'hidden'
    instead. The icon can be drawn as a background to the empty <i> element.
*/
var FileButtonView = NS.Class({

    Extends: NS.ButtonView,

    /**
        Property: O.FileButtonView#acceptMultiple
        Type: Boolean
        Default: false

        Should the user be allowed to select multiple files at once (if the
        browser supports it)?
    */
    acceptMultiple: false,

    /**
        Property: O.FileButtonView#acceptOnlyTypes
        Type: String
        Default: ''

        A comma-separated list of MIME types that may be selected by the user.
        Modern browsers only (set directly as the `accept` attribute in the
        `<input>` element).
    */
    acceptOnlyTypes: '',

    // --- Render ---

    /**
        Property: O.ButtonView#layerTag
        Type: String
        Default: 'label'

        Overrides default in <O.ButtonView#layerTag>.
    */
    layerTag: 'label',

    /**
        Property: O.FileButtonView#type
        Type: String
        Default: 'v-FileButton'

        Overrides default in <O.ButtonView#type>.
    */
    type: 'v-FileButton',

    /**
        Method: O.FileButtonView#draw

        Overridden to draw view. See <O.View#draw>. For DOM structure, see
        general <O.FileButtonView> notes.
    */
    draw: function ( layer, Element, el ) {
        var icon = this.get( 'icon' );
        return [
            el( 'i', {
                className: icon ? 'icon ' + icon : 'u-hidden'
            }),
            this._domControl = el( 'input', {
                className: 'v-FileButton-input',
                type: 'file',
                accept: this.get( 'acceptOnlyTypes' ) || undefined,
                multiple: this.get( 'acceptMultiple' ) && canUseMultiple
            }),
            NS.AbstractControlView.prototype.draw
                .call( this, layer, Element, el )
        ];
    },

    // --- Activate ---

    // Remove these methods. Must be handled by the browser.
    _activateOnClick: null,
    _activateOnEnter: null,

    /**
        Method: O.FileButtonView#activate

        Opens the OS file chooser dialog.
    */
    activate: function () {
        this._domControl.click();
    },

    /**
        Method (private): O.FileButtonView#_fileWasChosen

        Parameters:
            event - {Event} The change event.

        Calls the method or fires the action on the target (see <O.ButtonView>
        for description of these), with the files as the first argument or
        `files` property on the event object.
    */
    _fileWasChosen: function ( event ) {
        var input = this._domControl,
            files, filePath,
            target, action;
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
            if ( !this.get( 'isDisabled' ) ) {
                target = this.get( 'target' ) || this;
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
        }
    }.on( 'change' )
});

NS.FileButtonView = FileButtonView;

}( this.O ) );
