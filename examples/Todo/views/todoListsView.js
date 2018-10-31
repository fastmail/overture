/* global O */

import state from '../state.js';
import { actions } from '../actions.js';
import { editStore, undoManager } from '../models.js';
import TodoListItemView from './TodoListItemView.js';

const {
    bind,
    ButtonView,
    ListView,
    ToolbarView,
    Transform: { invert },
    DOMEvent: { lookupKey },
    View,
} = O;

export default new View({
    className: 'v-App',
    draw ( layer, Element, el ) {
        return [
            el('div.v-App-title', [ 'Your  Lists' ]),
            new ToolbarView({
                left: [
                    new ButtonView({
                        icon: 'icon-plus-circle',
                        isDisabled: bind( state, 'isLoadingList' ),
                        label: 'New Todo List',
                        shortcut: 'Enter',
                        target: actions,
                        method: 'newTodoList',
                    }),
                    new ButtonView({
                        icon: 'icon-rotate-left',
                        layout: { marginLeft: 10 },
                        isDisabled: bind( undoManager, 'canUndo', invert ),
                        label: 'Undo',
                        /* Can define a keyboard shortcut directly on the button
                           it is equivalent to. The shortcut will be active so
                           long as the button is in the document. */
                        shortcut: 'Cmd-z',
                        target: undoManager,
                        method: 'undo',
                    }),
                ],
            }),
            new View({
                className: 'v-TodoList',
                draw (/* layer, Element, el */) {
                    return [
                        new ListView({
                            content: bind( state, 'todoLists' ),
                            ItemView: TodoListItemView,
                            itemHeight: 48,
                        }),
                    ];
                },
            }),
        ];
    },

    stopEditing: function ( event ) {
        if ( this.get( 'isEditing' ) ) {
            const key = lookupKey( event );
            if ( key === 'Enter' || key === 'Escape' ) {
                this.set( 'isEditing', false );
                editStore.commitChanges();
                event.stopPropagation();
            }
        }
    }.on( 'keydown' ),

    newTodoList: function ( event ) {
        if ( event.targetView === this ) {
            actions.newTodoList();
        }
    }.on( 'dblclick' ),
});
