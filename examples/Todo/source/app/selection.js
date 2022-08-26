import { bind } from '/overture/foundation';
import { SingleSelectionController } from '/overture/selection';

import { state } from './state.js';

// --- Selection ---

/* The SingleSelectionController is for keeping track of which element is
   selected in a list. There's another class "SelectionController" (not
   currently used in this example app) for keeping track of a multi-selection.
*/
const selectedTodo = new SingleSelectionController({
    content: bind(state, 'todos'),
});

export { selectedTodo };
