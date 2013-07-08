// -------------------------------------------------------------------------- \\
// File: AbstractControlView.js                                               \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

/**
    Class: O.AbstractControlView

    Extends: O.View

    The superclass for most DOM-control view classes. This is an abstract class
    and should not be instantiated directly; it is only intended to be
    subclassed.
*/
var AbstractControlView = NS.Class({

    Extends: NS.View,

    /**
        Property: O.AbstractControlView#isDisabled
        Type: Boolean
        Default: false

        Is the control disabled?
    */
    isDisabled: false,

    /**
        Property: O.AbstractControlView#label
        Type: String|Element|null
        Default: ''

        A label for the control, to be displayed next to it.
    */
    label: '',

    /**
        Property: O.AbstractControlView#value
        Type: *
        Default: false

        The value represented by this control, for example true/false if a
        checkbox is checked/unchecked, or the text input into a textarea.
    */
    value: false,

    /**
        Property: O.AbstractControlView#tabIndex
        Type: Number|undefined
        Default: undefined

        If set, this will become the tab index for the control.
    */
    tabIndex: undefined,

    /**
        Property: O.AbstractControlView#shortcut
        Type: String
        Default: ''

        If set, this will be registered as the keyboard shortcut to activate the
        control when it is in the document.
    */
    shortcut: '',

    /**
        Property: O.AbstractControlView#tooltip
        Type: String
        Default: '' or 'Shortcut: <shortcut>'

        A tooltip to show when the mouse hovers over the view. Defaults to
        informing the user of the keyboard shortcut for the control, if set.
    */
    tooltip: function () {
        var shortcut = this.get( 'shortcut' );
        return shortcut ?
            NS.loc( 'Shortcut: [_1]',
                shortcut
                    .split( ' ' )
                    .map( NS.formatKeyForPlatform )
                    .join( ' ' + NS.loc( 'or' ) + ' ' )
            ) : '';
    }.property( 'shortcut' ),

    /**
        Method: O.AbstractControlView#didEnterDocument

        Overridden to add keyboard shortcuts.
        See <O.View#didEnterDocument>.
    */
    didEnterDocument: function () {
        var shortcut = this.get( 'shortcut' );
        if ( shortcut ) {
            shortcut.split( ' ' ).forEach( function ( key ) {
                NS.ViewEventsController.kbShortcuts
                    .register( key, this, 'activate' );
            }, this );
        }
        return AbstractControlView.parent.didEnterDocument.call( this );
    },

    /**
        Method: O.AbstractControlView#didEnterDocument

        Overridden to remove keyboard shortcuts.
        See <O.View#didEnterDocument>.
    */
    willLeaveDocument: function () {
        var shortcut = this.get( 'shortcut' );
        if ( shortcut ) {
            shortcut.split( ' ' ).forEach( function ( key ) {
                NS.ViewEventsController.kbShortcuts
                    .deregister( key, this, 'activate' );
            }, this );
        }
        return AbstractControlView.parent.willLeaveDocument.call(
            this );
    },

    /**
        Property: O.AbstractControlView#layerTag
        Type: String
        Default: 'label'

        Overrides default in <O.View#layerTag>.
   */
    layerTag: 'label',

    /**
        Property (private): O.AbstractControlView#_domControl
        Type: Element|null

        A reference to the DOM control managed by the view.
    */
    _domControl: null,

    /**
        Property (private): O.AbstractControlView#_domLabel
        Type: Element|null

        A reference to the DOM element containing the label for the view.
    */
    _domLabel: null,

    /**
        Method: O.AbstractControlView#draw

        Overridden to set properties and add label. See <O.View#draw>.
    */
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
            this._domLabel = el( 'span.label', [ this.get( 'label' ) ] )
        ]);
        layer.title = this.get( 'tooltip' );
    },

    // --- Keep render in sync with state ---

    abstractControlNeedsRedraw: function ( self, property, oldValue ) {
       return this.propertyNeedsRedraw( self, property, oldValue );
    }.observes( 'isDisabled', 'label', 'tooltip', 'tabIndex' ),

    /**
        Method: O.AbstractControlView#redrawIsDisabled

        Updates the disabled attribute on the DOM control to match the
        isDisabled property of the view.
    */
    redrawIsDisabled: function () {
        this._domControl.disabled = this.get( 'isDisabled' );
    },

    /**
        Method: O.AbstractControlView#redrawLabel

        Updates the DOM label to match the label property of the view.
    */
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

    /**
        Method: O.AbstractControlView#redrawTooltip

        Parameters:
            layer - {Element} The DOM layer for the view.

        Updates the title attribute on the DOM layer to match the tooltip
        property of the view.
    */
    redrawTooltip: function ( layer ) {
        layer.title = this.get( 'tooltip' );
    },

    /**
        Method: O.AbstractControlView#redrawTabIndex

        Updates the tabIndex attribute on the DOM control to match the tabIndex
        property of the view.
    */
    redrawTabIndex: function () {
        this._domControl.tabIndex = this.get( 'tabIndex' );
    },

    // --- Focus ---

    /**
        Method: O.AbstractControlView#focus

        Focusses the control.

        Returns:
            {O.AbstractControlView} Returns self.
    */
    focus: function () {
        if ( this.get( 'isInDocument' ) ) {
            this._domControl.focus();
        }
        return this;
    },

    /**
        Method: O.AbstractControlView#blur

        Removes focus from the control.

        Returns:
            {O.AbstractControlView} Returns self.
    */
    blur: function () {
        if ( this.get( 'isInDocument' ) ) {
            this._domControl.blur();
        }
        return this;
    },

    // --- Activate ---

    /**
        Method: O.AbstractControlView#activate

        An abstract method to be overridden by subclasses. This is the action
        performed when the control is activated, either by being clicked on or
        via a keyboard shortcut.
    */
    activate: function () {}

});

NS.AbstractControlView = AbstractControlView;

}( this.O ) );
