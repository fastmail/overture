/*global document */

import { Class } from '../../core/Core.js';
import /* { on } from */ '../../foundation/Decorators.js';
import { create as el } from '../../dom/Element.js';

import { ButtonView } from './ButtonView.js';
import { AbstractControlView } from './AbstractControlView.js';

/**
    Class: O.FileButtonView

    Extends: O.ButtonView

    A FileButtonView is used to allow the user to select a file (or multiple
    files) from their computer, which you can then upload to a server or, on
    modern browsers, read and manipulate directly.

    In general, FileButtonview is designed to be used just like an
    <O.ButtonView> instance, including styling.

    ### Styling O.FileButtonView ###

    The underlying DOM structure is:

        <button>
            <input type="file">
            ${view.icon}
            <span class="label">${view.label}</span>
        </button>

*/
const FileButtonView = Class({
    Extends: ButtonView,

    /**
        Property: O.FileButtonView#acceptMultiple
        Type: Boolean
        Default: false

        Should the user be allowed to select multiple files at once?
    */
    acceptMultiple: false,

    /**
        Property: O.FileButtonView#acceptFolder
        Type: Boolean
        Default: false

        Should the user be allowed to select a folder to upload instead of
        individual files (if the browser supports it)?
    */
    acceptFolder: false,

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
    draw(layer) {
        let icon = this.get('icon');
        if (typeof icon === 'string') {
            icon = ButtonView.drawIcon(icon);
        } else if (!icon) {
            icon = document.createComment('icon');
        }
        return [
            (this._domControl = el('input', {
                className: 'v-FileButton-input',
                type: 'file',
                accept: this.get('acceptOnlyTypes') || undefined,
                multiple: this.get('acceptMultiple'),
                webkitdirectory: this.get('acceptFolder') || undefined,
            })),
            icon,
            AbstractControlView.prototype.draw.call(this, layer),
        ];
    },

    // --- Activate ---

    /**
        Method: O.FileButtonView#activate

        Opens the OS file chooser dialog.
    */
    activate() {
        this._setIgnoreUntil();
        this._domControl.click();
        // On Edge, .click() blocks until the user closes the file picker. This
        // negates the previous _setIgnoreUntil() call, and so we need another.
        // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/20217742/
        this._setIgnoreUntil();
    },

    /**
        Method (private): O.FileButtonView#_fileWasChosen

        Parameters:
            event - {Event} The change event.

        Calls the method or fires the action on the target (see <O.ButtonView>
        for description of these), with the files as the first argument or
        `files` property on the event object.
    */
    _fileWasChosen: function (event) {
        const input = this._domControl;
        const files = Array.from(input.files);

        if (event.target === input && files.length) {
            if (!this.get('isDisabled')) {
                const target = this.get('target') || this;
                const method = this.get('method');
                const action = method ? null : this.get('action');
                if (method) {
                    target[method](files, this);
                } else if (action) {
                    target.fire(action, {
                        originView: this,
                        files,
                    });
                }
            }
        }
        input.value = '';
        this.fire('button:activate');
    }.on('change'),
});

export { FileButtonView };
