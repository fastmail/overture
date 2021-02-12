import { Class } from 'overture/core';
import { attr, NEW, Record, toOne } from 'overture/datastore';

import { TodoList } from './TodoList.js';

const Todo = Class({
    Name: 'Todo',

    Extends: Record,

    list: toOne({
        Type: TodoList,
        key: 'listId'
    }),

    precedence: attr( Number, {
        isNullable: false,
        defaultValue: 0
    }),

    isComplete: attr( Boolean, {
        isNullable: false,
        defaultValue: false
    }),

    summary: attr( String, {
        isNullable: false,
        defaultValue: ''
    }),

    // Ran out of time! TODO: add support for scheduling todos in UI.
    // start: Record.attr( Date, {
    //     defaultValue: null
    // }),

    autoCommitIsComplete: function () {
        if ( !( this.get( 'status' ) & NEW ) ) {
            this.store.commitChanges();
        }
    }.observes( 'isComplete' )
});
Todo.dataGroup = 'https://overturejs.com/Todo/';

export { Todo };