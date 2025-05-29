import { Class } from '../core/Core.js';
import { lookupKey } from '../dom/DOMEvent.js';
import { Obj } from '../foundation/Object.js';
import { isApple } from '../ua/UA.js';
import { RichTextView } from '../views/controls/RichTextView.js';
import { POINTER_MOVE } from '../views/View.js';
import { ViewEventsController } from '../views/ViewEventsController.js';
import {
    ACTIVE_IN_INPUT,
    DEFAULT_IN_INPUT,
    DISABLE_IN_INPUT,
} from './keyboardShortcuts.js';
import { toPlatformKey } from './toPlatformKey.js';

/* { on } from */
import '../foundation/Decorators.js';

// ---

/*global document */

/**
 A set of elements for which global keyboard shortcuts should still apply. Used
 by GlobalKeyboardShortcuts#trigger.
*/
const allowedInputs = new Set(['checkbox', 'radio', 'file', 'submit']);

/**
 A set of shortcuts which should be applied on (and only on) the 'keydown'
 event. Used by GlobalKeyboardShortcuts#trigger.
*/
const handleOnDown = new Set();

/**
    Class: O.GlobalKeyboardShortcuts

    Extends: O.Object

    This class facilitates adding keyboard shortcuts to your application.
    Registers with ViewEventsController on initialisation — intended to generate
    a singleton.
*/
const GlobalKeyboardShortcuts = Class({
    Name: 'GlobalKeyboardShortcuts',

    Extends: Obj,

    /**
        Property: O.GlobalKeyboardShortcuts#isEnabled
        Type: Boolean
        Default: true

        Callbacks will only fire if this property is true when the instance
        handles the event.
    */

    /**
        Property (private): O.GlobalKeyboardShortcuts#_shortcuts
        Type: Object

        The map of shortcut key to an array of `[object, method]` tuples.
    */

    /**
        Constructor: O.GlobalKeyboardShortcuts
    */
    init: function (/* ...mixins */) {
        this.isEnabled = true;
        this.inKBMode = false;
        this._shortcuts = {};

        GlobalKeyboardShortcuts.parent.constructor.apply(this, arguments);

        ViewEventsController.kbShortcuts = this;
        ViewEventsController.addEventTarget(this, -10);
    },

    /**
        Method: O.GlobalKeyboardShortcuts#destroy

        Destructor.
    */
    destroy() {
        if (ViewEventsController.kbShortcuts === this) {
            delete ViewEventsController.kbShortcuts;
        }
        ViewEventsController.removeEventTarget(this);
        GlobalKeyboardShortcuts.parent.destroy.call(this);
    },

    /**
        Method: O.GlobalKeyboardShortcuts#register

        Add a global keyboard shortcut. If a shortcut has already been
        registered for this key, it will be replaced, but will be restored when
        the new handler is removed.

        Parameters:
            key     - {String} The key to trigger the callback on. Modifier keys
                      (Alt, Ctrl, Meta, Shift) should be prefixed in
                      alphabetical order and with a hypen after each one.
                      Letters should be lower case. e.g. `Ctrl-f`.

                      The special modifier "Cmd-" may be used, which will map
                      to "Meta-" on a Mac (the command key) and "Ctrl-"
                      elsewhere.
            object  - {Object} The object to trigger the callback on.
            method  - {String} The name of the method to trigger.
            ifInput - {Number} Determines whether the shortcut is active when
                      focused inside an <input> or equivalent. Defaults to
                      active if and only if Meta or Ctrl are part of the
                      shortcut. The value must be one of:

                      * DEFAULT_IN_INPUT (Use the default)
                      * ACTIVE_IN_INPUT (Active when input is focused)
                      * DISABLE_IN_INPUT (Not active when input is focused)

        Returns:
            {O.GlobalKeyboardShortcuts} Returns self.
    */
    register(key, object, method, ifInput) {
        key = toPlatformKey(key);
        const shortcuts = this._shortcuts;
        (shortcuts[key] || (shortcuts[key] = [])).push([
            object,
            method,
            ifInput || DEFAULT_IN_INPUT,
        ]);
        return this;
    },

    /**
        Method: O.GlobalKeyboardShortcuts#deregister

        Remove a global keyboard shortcut. Must use identical arguments to those
        which were used in the call to <O.GlobalKeyboardShortcuts#register>.

        Parameters:
            key    - {String} The key on which the callback was triggered.
            object - {Object} The object on which the callback was triggered.
            method - {String} The name of the method that was being triggered.

        Returns:
            {O.GlobalKeyboardShortcuts} Returns self.
    */
    deregister(key, object, method) {
        key = toPlatformKey(key);
        const current = this._shortcuts[key];
        const length = current ? current.length : 0;
        for (let i = length - 1; i >= 0; i -= 1) {
            const item = current[i];
            if (item[0] === object && item[1] === method) {
                if (length === 1) {
                    delete this._shortcuts[key];
                } else {
                    current.splice(i, 1);
                    break;
                }
            }
        }
        return this;
    },

    /**
        Method: O.GlobalKeyboardShortcuts#getHandlerForKey

        Get the keyboard shortcut to be triggered by a key combo, represented as
        a string, as output by <O.DOMEvent#lookupKey>.

        Parameters:
            key - {String} The key combo to get the handler for.

        Returns:
            {Array|null} Returns the [ object, method ] tuple to be triggered by
            the event, or null if nothing is registered for this key press or if
            isEnabled is false.
    */
    getHandlerForKey(key) {
        const shortcuts = this._shortcuts[key];
        if (shortcuts) {
            return shortcuts[shortcuts.length - 1];
        }
        return null;
    },

    /**
        Method: O.GlobalKeyboardShortcuts#trigger

        Keypress event handler. Triggers any registered callback.

        Parameters:
            event - {DOMEvent} The keydown/keypress event.
            accept - {Function} (optional) A function that returns a Boolean to determine whether the handler should be run for the event.
    */
    trigger: function (event, accept) {
        const target = event.target;
        const nodeName = target.nodeName;
        const key = lookupKey(event);
        const allowedInInput =
            (isApple ? event.metaKey : event.ctrlKey) &&
            (event.altKey || /-(?:.|Enter)$/.test(key));
        const inputIsFocused =
            nodeName === 'TEXTAREA' ||
            nodeName === 'SELECT' ||
            (nodeName === 'INPUT' && !allowedInputs.has(target.type)) ||
            event.targetView instanceof RichTextView;
        if (event.type === 'keydown') {
            handleOnDown.add(key);
        } else if (handleOnDown.has(key)) {
            return;
        }
        if (!this.get('isEnabled')) {
            return;
        }
        const handler = this.getHandlerForKey(key);
        if (handler) {
            const accepted = accept ? accept(handler) : true;
            if (!accepted) {
                return;
            }
            const ifInput = handler[2];
            if (
                inputIsFocused &&
                ifInput !== ACTIVE_IN_INPUT &&
                (!allowedInInput || ifInput === DISABLE_IN_INPUT)
            ) {
                return;
            }
            this.set('inKBMode', true);
            handler[0][handler[1]](event);
            if (!event.doDefault) {
                event.preventDefault();
            }
        }
    }.on('keydown', 'keypress'),

    mousemove: function () {
        this.set('inKBMode', false);
    }.on(POINTER_MOVE),

    handleEvent(event) {
        this.fire(event.type, event);
    },

    setupMouseMove: function () {
        if (this.get('inKBMode')) {
            document.addEventListener(POINTER_MOVE, this, false);
        } else {
            document.removeEventListener(POINTER_MOVE, this, false);
        }
    }.observes('inKBMode'),

    activateKey(key) {
        const handler = this.getHandlerForKey(key);
        if (handler) {
            handler[0][handler[1]]({ type: 'activateKey' });
        }
    },
});

// ---

export {
    GlobalKeyboardShortcuts,
    DEFAULT_IN_INPUT,
    ACTIVE_IN_INPUT,
    DISABLE_IN_INPUT,
};
