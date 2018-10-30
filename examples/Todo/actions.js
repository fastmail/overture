/* global O */

import { editStore, undoManager, Todo, TodoList } from './models.js';
import state from './state.js';
import { selectedThing } from './selection.js';

const { GlobalKeyboardShortcuts } = O;

// --- Actions ---

/* Self explanatory */
const actions = {
    selectNext () {
        const list = state.get( 'things' );
        const index = selectedThing.get( 'index' ) + 1;
        if ( index < list.get( 'length' ) ) {
            selectedThing.set( 'index', index );
        }
    },

    selectPrevious () {
        const index = selectedThing.get( 'index' );
        if ( index > 0 ) {
            selectedThing.set( 'index', index - 1 );
        }
    },

    newTodoList () {
        // Create todo list
        const things = state.get( 'things' );
        const selectedIndex = selectedThing.get( 'index' );
        const newTodoList = new TodoList( editStore );

        // TODO: finish this stuff. Considerations: order is not in the model
        // for TodoList at present.

        // Place just after selected todo, or at end of list if none selected
        this.reorderTodoList( things, newTodoList,
            selectedIndex > -1 ? selectedIndex + 1 : things.get( 'length' )
        );
        newTodoList.saveToStore();

        // Select new todo
        selectedThing.set( 'record', newTodoList );
        state.set( 'editTodoList', newTodoList );
    },

    newTodo () {
        // Create todo
        const things = state.get( 'things' );
        const selectedIndex = selectedThing.get( 'index' );
        const newTodo = new Todo( editStore );

        // Assign to the currently selected list.
        newTodo.set( 'list',
            state.get( 'list' ).getDoppelganger( editStore ) );

        // Place just after selected todo, or at end of list if none selected
        this.reorderTodo( things, newTodo,
            selectedIndex > -1 ? selectedIndex + 1 : things.get( 'length' )
        );
        newTodo.saveToStore();

        // Select new todo
        selectedThing.set( 'record', newTodo );
        state.set( 'editTodo', newTodo );
    },

    reorderTodo ( list, todo, toIndex ) {
        const index = list.indexOf( todo );
        let prev;
        let next;

        if ( index === toIndex ) {
            return;
        }
        if ( -1 < index && index < toIndex ) {
            prev = list.getObjectAt( toIndex );
            next = list.getObjectAt( toIndex + 1 ) || null;
        } else {
            prev = toIndex ? list.getObjectAt( toIndex - 1 ) : null;
            next = list.getObjectAt( toIndex );
        }

        let prevPrec = prev ? prev.get( 'precedence' ) : 0;
        let nextPrec = next ? next.get( 'precedence' ) : ( toIndex + 2 ) * 32;

        if ( nextPrec - prevPrec < 2 ) {
            const listLength = list.get( 'length' );
            for ( let i = 0, p = 32; i < listLength; i += 1, p += 32 ) {
                const otherTodo = list.getObjectAt( i );
                if ( otherTodo !== todo ) {
                    otherTodo.set( 'precedence', p );
                    if ( otherTodo === prev ) {
                        p += 32;
                    }
                }
            }
            if ( prev ) {
                prevPrec = prev.get( 'precedence' );
            }
            if ( next ) {
                nextPrec = next.get( 'precedence' );
            }
        }
        todo.set( 'precedence', ( nextPrec + prevPrec ) >> 1 );
    },

    reorderTodoList () {
        // TODO
    },

    toggleComplete () {
        const todo = selectedThing.get( 'record' );
        if ( todo ) {
            todo.toggle( 'isComplete' );
        }
    },

    edit () {
        const thing = selectedThing.get( 'record' );
        if ( thing ) {
            state.set( 'editThing', thing );
        }
    },

    destroy () {
        const todo = selectedThing.get( 'record' );
        if ( todo ) {
            todo.destroy();
        }
        editStore.commitChanges();
    },
};

/* Self explanatory */
const keyboardShortcuts = new GlobalKeyboardShortcuts()
    .register( 'ArrowDown', actions, 'selectNext' )
    .register( 'ArrowUp', actions, 'selectPrevious' )
    .register( 'j', actions, 'selectNext' )
    .register( 'k', actions, 'selectPrevious' )
    .register( 'Cmd-Shift-z', undoManager, 'redo' )
    .register( 'Space', actions, 'toggleComplete' )
    .register( 'Tab', actions, 'edit' )
    .register( 'Backspace', actions, 'destroy' );

// --- Exports

export {
    actions,
    keyboardShortcuts,
};
