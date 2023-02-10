import { Class } from '../core/Core.js';
import { Obj } from '../foundation/Object.js';

//  ---

const AutoCompleteSource = Class({
    Name: 'AutoCompleteSource',

    Extends: Obj,

    /**
     * The name for the section
     * @type {string}
     */
    name: '',

    /**
     * Item height for if suggestions are progressively rendered. If falsey,
     * presumed dynamic and so never progressively rendered.
     * @type {number | null}
     */
    itemHeight: null,

    /** @type {'top' | 'bottom' | null} */
    pinTo: null,

    /**
     * @param {AutoCompleteContext} context
     * @returns {AutoCompleteSuggestion[] | null}
     */
    getSuggestions(/*context*/) {
        return null;
    },

    /** @param {AutoCompleteContext} context */
    isClearable(/*context*/) {
        return false;
    },

    clear() {},
});

// ---

export { AutoCompleteSource };
