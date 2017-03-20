// -------------------------------------------------------------------------- \\
// File: AbstractControlView.js                                               \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, UA, View, Application, Localisation       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../../core/Core.js';
import '../../foundation/ComputedProps.js';  // For Function#property
import '../../foundation/EventTarget.js';  // For Function#on
import '../../foundation/ObservableProps.js';  // For Function#observes
import View from '../View.js';
import ViewEventsController from '../ViewEventsController.js';
import { loc } from '../../localisation/LocaleController.js';
import formatKeyForPlatform from '../../application/formatKeyForPlatform.js';
import UA from '../../ua/UA.js';
import Element from '../../dom/Element.js';

/**
    Class: O.AbstractControlView

    Extends: O.View

    The superclass for most DOM-control view classes. This is an abstract class
    and should not be instantiated directly; it is only intended to be
    subclassed.
*/
var AbstractControlView = Class({

    Extends: View,

    /**
        Property: O.AbstractControlView#isDisabled
        Type: Boolean
        Default: false

        Is the control disabled?
    */
    isDisabled: false,

    /**
        Property: O.AbstractControlView#isFocussed
        Type: Boolean

        Represents whether the control currently has focus or not.
    */
    isFocussed: false,

    /**
        Property: O.AbstractControlView#label
        Type: String|Element|null
        Default: ''

        A label for the control, to be displayed next to it.
    */
    label: '',

    /**
        Property: O.AbstractControlView#name
        Type: String|undefined
        Default: undefined

        If set, this will be the name attribute of the control.
    */
    name: undefined,

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
            loc( 'Shortcut: [_1]',
                shortcut
                    .split( ' ' )
                    .map( formatKeyForPlatform )
                    .join( ' ' + loc( 'or' ) + ' ' )
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
                ViewEventsController.kbShortcuts
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
                ViewEventsController.kbShortcuts
                    .deregister( key, this, 'activate' );
            }, this );
        }
        // iOS is very buggy if you remove a focussed control from the doc;
        // the picker/keyboard stays up and cannot be dismissed
        if ( UA.isIOS && this.get( 'isFocussed' ) ) {
            this.blur();
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
    draw: function ( layer, Element, el ) {
        var control = this._domControl,
            name = this.get( 'name' ),
            shortcut = this.get( 'shortcut' ),
            tabIndex = this.get( 'tabIndex' );

        if ( !control.id ) {
            control.id = this.get( 'id' ) + '-input';
        }
        control.disabled = this.get( 'isDisabled' );

        if ( name !== undefined ) {
            control.name = name;
        }

        if ( tabIndex !== undefined ) {
            control.tabIndex = tabIndex;
        }

        if ( shortcut && ( /^\w$/.test( shortcut ) ) ) {
            control.accessKey = shortcut;
        }

        layer.title = this.get( 'tooltip' );
        return this._domLabel = el( 'span.label', [ this.get( 'label' ) ] );
    },

    // --- Keep render in sync with state ---

    abstractControlNeedsRedraw: function ( self, property, oldValue ) {
       return this.propertyNeedsRedraw( self, property, oldValue );
    }.observes( 'isDisabled', 'label', 'name', 'tooltip', 'tabIndex' ),

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
        Element.appendChildren( label, [
            this.get( 'label' )
        ]);
    },

    /**
        Method: O.AbstractControlView#redrawName

        Updates the name attribute on the DOM control to match the name
        property of the view.
    */
    redrawName: function () {
        this._domControl.name = this.get( 'name' );
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
            // Fire event synchronously.
            if ( !this.get( 'isFocussed' ) ) {
                this.fire( 'focus' );
            }
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
            // Fire event synchronously.
            if ( this.get( 'isFocussed' ) ) {
                this.fire( 'blur' );
            }
        }
        return this;
    },

    /**
        Method (private): O.AbstractControlView#_updateIsFocussed

        Updates the <#isFocussed> property.

        Parameters:
            event - {Event} The focus event.
    */
    _updateIsFocussed: function ( event ) {
        this.set( 'isFocussed', event.type === 'focus' );
    }.on( 'focus', 'blur' ),

    // --- Activate ---

    /**
        Method: O.AbstractControlView#activate

        An abstract method to be overridden by subclasses. This is the action
        performed when the control is activated, either by being clicked on or
        via a keyboard shortcut.
    */
    activate: function () {}

});

export default AbstractControlView;
