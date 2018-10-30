/* global O */

import { appView } from './poorlyNamedModule.js';
import state from '../state.js';
import { selectedTodo } from '../selection.js';

const { RootView, ButtonView } = O;

/* A RootView instance is required for each browser window under the control of
   your app
*/
export default new RootView( document, {
    selectNone: function ( event ) {
        if ( !( event.targetView instanceof ButtonView ) ) {
            appView.set( 'isEditing', false );
            state.set( 'editTodo', null );
            selectedTodo.set( 'record', null );
        }
    }.on( 'click' ),
});
