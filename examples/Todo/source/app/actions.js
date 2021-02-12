import { state } from './state.js';
import { store } from './store.js';
import { selectedTodo } from './selection.js';
import { Todo } from './Todo.js';

const selectNext = function() {
    const list = state.get( 'todos' );
        const index = selectedTodo.get( 'index' ) + 1;
    if ( index < list.get( 'length' ) ) {
        selectedTodo.set( 'index', index );
    }
};

const selectPrevious = function() {
    const index = selectedTodo.get( 'index' );
    if ( index > 0 ) {
        selectedTodo.set( 'index', index - 1 );
    }
};

const create = function() {
    // Create todo
    const todos = state.get( 'todos' );
    const selectedIndex = selectedTodo.get( 'index' );
    const newTodo = new Todo( store );

    // Assign to the currently selected list.
    newTodo.set( 'list',
        state.get( 'list' ).getDoppelganger( store ) );

    // Place just after selected todo, or at end of list if none selected
    this.reorderTodo( todos, newTodo,
        selectedIndex > -1 ? selectedIndex + 1 : todos.get( 'length' )
    );
    newTodo.saveToStore();

    // Select new todo
    selectedTodo.set( 'record', newTodo );
    state.set( 'editTodo', newTodo );
};

const reorderTodo = function( list, todo, toIndex ) {
    const index = list.indexOf( todo );
        let prev; let next; let prevPrec; let nextPrec;
        let i; let p; let l; let otherTodo;

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
};

const toggleComplete = function() {
    const todo = selectedTodo.get( 'record' );
    if ( todo ) {
        todo.toggle( 'isComplete' );
    }
};

const edit = function() {
    const todo = selectedTodo.get( 'record' );
    if ( todo ) {
        state.set( 'editTodo', todo );
    }
};

const destroy = function() {
    const todo = selectedTodo.get( 'record' );
    if ( todo ) {
        todo.destroy();
    }
    store.commitChanges();
};

export {
    selectNext,
    selectPrevious,
    create,
    reorderTodo,
    toggleComplete,
    edit,
    destroy,
}