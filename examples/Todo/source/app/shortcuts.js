import { GlobalKeyboardShortcuts } from 'overture/application';

import * as actions from './actions.js';
import { undoManager } from './store.js';

const keyboardShortcuts = new GlobalKeyboardShortcuts()
    .register( 'ArrowDown', actions, 'selectNext' )
    .register( 'ArrowUp', actions, 'selectPrevious' )
    .register( 'j', actions, 'selectNext' )
    .register( 'k', actions, 'selectPrevious' )
    .register( 'Cmd-Shift-Z', undoManager, 'redo' )
    .register( 'Space', actions, 'toggleComplete' )
    .register( 'Tab', actions, 'edit' )
    .register( 'Backspace', actions, 'destroy' );

export { keyboardShortcuts };