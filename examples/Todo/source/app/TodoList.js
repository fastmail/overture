import { Class } from 'overture/core';
import { attr, Record } from 'overture/datastore';
import { loc } from 'overture/localisation';

/*
    A TodoList is simply a name for a collection of todos. All todos belong
    to a single TodoList.

    I ran out of time to build support into the UI for multiple todo lists;
    pull requests welcome!
*/
const TodoList = Class({
    Name: 'TodoList',

    Extends: Record,

    name: attr( String, {
        defaultValue: '',
        validate ( propValue/*, propKey, record*/ ) {
            let error = '';
            if ( !propValue ) {
                error = loc( 'Required' );
            }
            else if ( propValue.length > 25 ) {
                error = loc( 'Too long: use at most [*2,_1,%n character,%n characters].', 25 );
            }
            return error;
        }
    })
});
TodoList.dataGroup = 'https://overturejs.com/Todo/';

export { TodoList };