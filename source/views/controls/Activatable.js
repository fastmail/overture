import { DEFAULT_IN_INPUT } from '../../application/keyboardShortcuts.js';
import { toPlatformKey } from '../../application/toPlatformKey.js';
import { ViewEventsController } from '../ViewEventsController.js';

/* { property, observes } from */
import '../../foundation/Decorators.js';

/**
    Mixin: O.Activatable

    The Activatable mixin should be applied to views that can be activated, with
    a click or shortcut key, to perform some action.
*/
const Activatable = {
    /**
        Property: O.Activatable#shortcut
        Type: String
        Default: ''

        If set, this will be registered as the keyboard shortcut to activate the
        control when it is in the document.
    */
    shortcut: '',

    /**
        Property: O.Activatable#shortcutWhenInputFocused
        Type: Enum
        Default: GlobalKeyboardShortcuts.DEFAULT_IN_INPUT

        If a shortcut is set, should it be active when an input is focused?
    */
    shortcutWhenInputFocused: DEFAULT_IN_INPUT,

    /**
        Property: O.Activatable#tooltip
        Type: String
        Default: ''

        A tooltip to show when the mouse hovers over the view.
    */
    tooltip: '',

    didCreateLayer(layer) {
        this.redrawTooltip(layer);
    },

    getShortcutTarget(key) {
        const shortcut = this.get('shortcut').split(' ')[0];
        if (shortcut === '') {
            return null;
        }
        return toPlatformKey(shortcut) === key ? this.get('layer') : null;
    },

    _updateShortcutRegistration: function () {
        if (this.get('isInDocument')) {
            const shortcut = this.get('shortcut');
            if (shortcut) {
                shortcut.split(' ').forEach((key) => {
                    ViewEventsController.kbShortcuts.register(
                        key,
                        this,
                        'activate',
                        this.get('shortcutWhenInputFocused'),
                    );
                });
            }
        } else {
            const shortcut = this.get('shortcut');
            if (shortcut) {
                shortcut.split(' ').forEach((key) => {
                    ViewEventsController.kbShortcuts.deregister(
                        key,
                        this,
                        'activate',
                    );
                });
            }
        }
    }.observes('isInDocument'),

    // --- Keep render in sync with state ---

    tooltipNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('tooltip'),

    /**
        Method: O.Activatable#redrawTooltip

        Parameters:
            layer - {Element} The DOM layer for the view.

        Updates the title attribute on the DOM layer to match the tooltip
        property of the view.
    */
    redrawTooltip(layer) {
        const tooltip = this.get('tooltip');
        if (tooltip) {
            layer.title = tooltip;
        }
    },

    // --- Activate ---

    /**
        Method: O.Activatable#activate

        An abstract method to be overridden by subclasses. This is the action
        performed when the target is activated, either by being clicked on or
        via a keyboard shortcut.
    */
    activate() {},
};

export { Activatable };
