import { Class } from '../core/Core.js';
import { Obj } from '../foundation/Object.js';

// ---

/**
 * @typedef {object} AutoCompleteContext
 * @property {any} controller
 * @property {string} search
 * @property {{ start: number, end: number }} selection
 */

/**
 * This class is meant to be extended as appropriate for different suggestion
 * types.
 *
 * Instances of this class do not depend on context so can be reused.
 * Everything is lazily computed so can be skipped entirely if progressively
 * rendered.
 */

const AutoCompleteSuggestion = Class({
    Name: 'AutoCompleteSuggestion',

    Extends: Obj,

    /**
     * Draws an icon. Returns a DOM node or View.
     *
     * @param {AutoCompleteContext} context
     */
    drawIcon() {
        return null;
    },

    /**
     * Draws the main label. This can just return plain text, or can return
     * an array of text/DOM nodes with highlighted sections in <mark> nodes.
     * text/selection/context passed in to allow for highlighting.
     *
     * @param {AutoCompleteContext} context
     * @returns {string | HTMLElement[] | null}
     */
    drawLabel() {
        return null;
    },

    /**
     * Draws the secondary label, if any. This can just return plain text, or
     * can return an array of text/DOM nodes with highlighted sections in
     * <mark> nodes.
     *
     * @param {AutoCompleteContext} context
     * @returns {string | HTMLElement[] | null}
     */
    drawDescription() {
        return null;
    },

    /**
     * Returns help text, if any as a plain string.
     *
     * @param {AutoCompleteContext} context
     * @returns {string | null}
     */
    drawHelpText() {
        return null;
    },

    // ---

    /**
     * Returns a change object that can be applied to update the current
     * search string with this suggestion.
     *
     * @param {AutoCompleteContext} context
     * @returns {Change}
     */
    getChange() {
        return null;
    },

    /**
     * Hook called when the suggestion is selected. If false is returned, the
     * autocomplete controller won't take any action with this suggestion.
     *
     * @param {AutoCompleteContext} context
     * @returns {boolean}
     */
    accept(/*context*/) {
        return true;
    },

    /**
     * If this method returns `true`, the suggestion will be rendered with an
     * additional control that allows users to remove it.
     *
     * @param {AutoCompleteContext} context
     * @returns {boolean}
     */
    isRemovable(/*context*/) {
        return false;
    },

    /**
     * Hook called when the suggestion is removed. Override in subclass to do
     * something useful!
     */
    remove() {},
});

// ---

export { AutoCompleteSuggestion };
