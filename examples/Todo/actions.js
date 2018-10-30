import { editStore, undoManager, Todo, TodoList } from './models.js';
import state from './state.js';
import { selectedTodo, selectedTodoList } from './selection.js';

const { GlobalKeyboardShortcuts } = O;

// --- Actions ---

/* Self explanatory */
const actions = {
    selectNext: function () {
        var list = state.get( 'todos' ),
            index = selectedTodo.get( 'index' ) + 1;
        if ( index < list.get( 'length' ) ) {
            selectedTodo.set( 'index', index );
        }
    },

    selectPrevious: function () {
        var index = selectedTodo.get( 'index' );
        if ( index > 0 ) {
            selectedTodo.set( 'index', index - 1 );
        }
    },

    newTodoList: function () {
        // Create todo list
        var todoLists = state.get( 'todoLists' ),
            selectedIndex = selectedTodoList.get( 'index' ),
            newTodoList = new TodoList( editStore );

        // TODO: finish this stuff. Considerations: order is not in the model
        // for TodoList at present.

        // Place just after selected todo, or at end of list if none selected
        this.reorderTodoList( todoLists, newTodoList,
            selectedIndex > -1 ? selectedIndex + 1 : todoLists.get( 'length' )
        );
        newTodoList.saveToStore();

        // Select new todo
        selectedTodoList.set( 'record', newTodoList );
        state.set( 'editTodoList', newTodoList );

    },

    newTodo: function () {
        // Create todo
        var todos = state.get( 'todos' ),
            selectedIndex = selectedTodo.get( 'index' ),
            newTodo = new Todo( editStore );

        // Assign to the currently selected list.
        newTodo.set( 'list',
            state.get( 'list' ).getDoppelganger( editStore ) );

        // Place just after selected todo, or at end of list if none selected
        this.reorderTodo( todos, newTodo,
            selectedIndex > -1 ? selectedIndex + 1 : todos.get( 'length' )
        );
        newTodo.saveToStore();

        // Select new todo
        selectedTodo.set( 'record', newTodo );
        state.set( 'editTodo', newTodo );
    },

    reorderTodo: function ( list, todo, toIndex ) {
        var index = list.indexOf( todo ),
            prev, next, prevPrec, nextPrec,
            i, p, l, otherTodo;

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

        prevPrec = prev ? prev.get( 'precedence' ) : 0;
        nextPrec = next ? next.get( 'precedence' ) : ( toIndex + 2 ) * 32;

        if ( nextPrec - prevPrec < 2 ) {
            for ( i = 0, p = 32, l = list.get( 'length' );
                    i < l; i += 1, p += 32 ) {
                otherTodo = list.getObjectAt( i );
                if ( otherTodo !== todo ) {
                    otherTodo.set( 'precedence', p );
                    if ( otherTodo === prev ) {
                        p += 32;
                    }
                }
            }
            if ( prev ) { prevPrec = prev.get( 'precedence' ); }
            if ( next ) { nextPrec = next.get( 'precedence' ); }
        }
        todo.set( 'precedence', ( nextPrec + prevPrec ) >> 1 );
    },

    toggleComplete: function () {
        var todo = selectedTodo.get( 'record' );
        if ( todo ) {
            todo.toggle( 'isComplete' );
        }
    },

    edit: function () {
        var todo = selectedTodo.get( 'record' );
        if ( todo ) {
            state.set( 'editTodo', todo );
        }
    },

    destroy: function () {
        var todo = selectedTodo.get( 'record' );
        if ( todo ) {
            todo.destroy();
        }
        editStore.commitChanges();
    }
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
