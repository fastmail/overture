/* global O */

import state from './state.js';

const {
    bind,
    SingleSelectionController,
} = O;

/* The SingleSelectionController is for keeping track of which element is
   selected in a list. There's another class "SelectionController" (not
   currently used in this example app) for keeping track of a multi-selection.
*/
const selectedThing = new SingleSelectionController({
    content: bind( state, 'things' ),
});

export {
    selectedThing,
};
