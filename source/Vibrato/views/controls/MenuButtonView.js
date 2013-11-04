// -------------------------------------------------------------------------- \\
// File: MenuButtonView.js                                                    \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, ButtonView.js                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Class: O.MenuButtonView

    Extends: O.ButtonView

    A MenuButtonView reveals a menu when pressed. Example usage:

        new O.MenuButtonView({
            label: 'Select File',
            icon: 'more',
            popOverView: new O.PopOverView(),
            menuView: new O.MenuView({
                showFilter: false,
                closeOnActivate: true,
                options: [
                    new O.FileButtonView({
                        label: 'Upload From Computer',
                        acceptMultiple: true,
                        target: controller,
                        method: 'uploadFiles'
                    }),
                    new O.ButtonView({
                        label: 'Select From Dropbox',
                        target: controller,
                        method: 'selectFromDropbox'
                    })
                ]
            })
        });
*/
var MenuButtonView = NS.Class({

    Extends: NS.ButtonView,

    /**
        Property: O.MenuButtonView#type
        Type: String
        Default: 'MenuButtonView'

        Overrides default in <O.ButtonView#type>.
    */
    type: 'MenuButtonView',

    /**
        Property: O.MenuButtonView#popOverView
        Type: O.PopOverView

        The <O.PopOverView> instance to use to show the menu view.
    */
    popOverView: null,

    /**
        Property: O.MenuButtonView#popOverViewOptions
        Type: Object

        Options to pass to <O.PopOverView#show>.
    */
    popOverOptions: {},

    /**
        Property: O.MenuButtonView#menuView
        Type: O.MenuView

        The <O.MenuView> instance to show when the button is pressed.
    */
    menuView: null,

    /**
        Property: O.MenuButtonView#alignMenu
        Type: String
        Default: 'left'

        Which of the menu and button edges should be aligned? Valid options are
        'left', 'right' or 'centre'.
    */
    alignMenu: 'left',

    /**
        Property: O.MenuButtonView#isInMenu
        Type: Boolean

        Is this a child view of an <O.MenuOptionView>?
    */
    isInMenu: function () {
        return this.get( 'parentView' ) instanceof NS.MenuOptionView;
    }.property( 'parentView' ),

    // --- Activate ---

    /**
        Method: O.MenuButtonView#activate

        Overridden to show menu associated with button, if not already visible.
        Ignores target/method/action properties.
    */
    activate: function () {
        if ( !this.get( 'isActive' ) && !this.get( 'isDisabled' ) ) {
            this.set( 'isActive', true );
            var buttonView = this,
                isInMenu = this.get( 'isInMenu' ),
                popOverView, offsetTop, offsetLeft, menuOptionView;
            if ( isInMenu ) {
                popOverView = this.getParent( NS.PopOverView );
                // Align top of submenu with top of menu button.
                offsetTop = -this.get( 'pxHeight' ) - 4;
                // And to the right hand side
                offsetLeft = this.get( 'pxWidth' );
                menuOptionView = this.get( 'parentView' );
            } else {
                popOverView = this.get( 'popOverView' );
            }
            // If the isInMenu, the popOverView used will actually be a subview
            // of this popOverView, and is returned from the show method.
            popOverView = popOverView.show( NS.extend({
                view: this.get( 'menuView' ),
                alignWithView: isInMenu ? popOverView : this,
                atNode: isInMenu ? this.get( 'layer' ) : null,
                alignEdge: this.get( 'alignMenu' ),
                offsetTop: offsetTop,
                offsetLeft: offsetLeft,
                onHide: function () {
                    buttonView.set( 'isActive', false );
                    if ( menuOptionView ) {
                        menuOptionView.removeObserverForKey(
                            'isFocussed', popOverView, 'hide' );
                    }
                }
            }, this.get( 'popOverOptions' ) ) );
            if ( menuOptionView ) {
                menuOptionView.addObserverForKey(
                    'isFocussed', popOverView, 'hide' );
            }
        }
    },

    // --- Keep state in sync with render ---

    /**
        Method (private): O.MenuButtonView#_activateOnMousedown

        Activates the button on mousedown, not just on click. This allows the
        user to press the mouse down on the button to show the menu, drag down
        to the option they want, then release the button to select it.
    */
    _activateOnMousedown: function ( event ) {
        if ( event.button || event.metaKey || event.ctrlKey ) {
            return;
        }
        this.activate();
    }.on( 'mousedown' )
});

NS.MenuButtonView = MenuButtonView;

}( this.O ) );
