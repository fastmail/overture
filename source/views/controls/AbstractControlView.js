import { Class } from '../../core/Core.js';
import { isIOS } from '../../ua/UA.js';
import { View } from '../View.js';

/* { on, observes } from */
import '../../foundation/Decorators.js';

/**
    Class: O.AbstractControlView

    Extends: O.View

    The superclass for most DOM-control view classes. This is an abstract class
    and should not be instantiated directly; it is only intended to be
    subclassed.
*/
const AbstractControlView = Class({
    Name: 'AbstractControlView',

    Extends: View,

    /**
        Property: O.AbstractControlView#isDisabled
        Type: Boolean
        Default: false

        Is the control disabled?
    */
    isDisabled: false,

    /**
        Property: O.AbstractControlView#isFocused
        Type: Boolean

        Represents whether the control currently has focus or not.
    */
    isFocused: false,

    /**
        Property: O.AbstractControlView#tabIndex
        Type: Number
        Default: 0

        If set, this will become the tab index for the control.
    */
    tabIndex: 0,

    /**
        Property: O.AbstractControlView#type
        Type: String
        Default: ''

        A space-separated list of CSS classnames to give the layer in the DOM,
        irrespective of state.
    */
    type: '',

    /**
        Property: O.AbstractControlView#baseClassName
        Type: String
        Default: ''

        A string prepended to class names used by this view.
    */
    baseClassName: '',

    /**
        Method: O.AbstractControlView#didEnterDocument

        Overridden to drop focus before leaving the DOM.
        See <O.View#didEnterDocument>.
    */
    willLeaveDocument() {
        // iOS is very buggy if you remove a focused control from the doc;
        // the picker/keyboard stays up and cannot be dismissed
        if (isIOS && this.get('isFocused')) {
            this.blur();
        }
        return AbstractControlView.parent.willLeaveDocument.call(this);
    },

    /**
        Property (private): O.AbstractControlView#_domControl
        Type: Element|null

        A reference to the DOM control managed by the view.
    */
    _domControl: null,

    // --- Keep render in sync with state ---

    abstractControlNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('isDisabled', 'tabIndex'),

    /**
        Method: O.AbstractControlView#redrawIsDisabled

        Updates the disabled attribute on the DOM control to match the
        isDisabled property of the view.
    */
    redrawIsDisabled() {
        this._domControl.disabled = this.get('isDisabled');
    },

    /**
        Method: O.AbstractControlView#redrawTabIndex

        Updates the tabIndex attribute on the DOM control to match the tabIndex
        property of the view.
    */
    redrawTabIndex() {
        this._domControl.tabIndex = this.get('tabIndex');
    },

    // --- Focus ---

    /**
        Method: O.AbstractControlView#focus

        Focusses the control.

        Returns:
            {O.AbstractControlView} Returns self.
    */
    focus() {
        if (this.get('isInDocument')) {
            this._domControl.focus({
                preventScroll: true,
            });
            // Fire event synchronously.
            if (!this.get('isFocused')) {
                this.fire('focus', {
                    target: this._domControl,
                    targetView: this,
                });
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
    blur() {
        if (this.get('isInDocument')) {
            this._domControl.blur();
            // Fire event synchronously.
            if (this.get('isFocused')) {
                this.fire('blur', {
                    target: this._domControl,
                    targetView: this,
                });
            }
        }
        return this;
    },

    /**
        Method (private): O.AbstractControlView#_updateIsFocused

        Updates the <#isFocused> property.

        Parameters:
            event - {Event} The focus event.
    */
    _updateIsFocused: function (event) {
        this.set(
            'isFocused',
            event.type === 'focus' && event.target === this._domControl,
        );
    }.on('focus', 'blur'),
});

export { AbstractControlView };
