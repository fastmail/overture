import { Connection } from '../Connection.js';
import { Todo } from './Todo.js';
import { TodoList } from './TodoList.js';

// --- Model ---

/*  The source is the connection from the store to the server for fetching
    and modifying records. The JMAP.Connection class automatically uses the
    JSON API format used in the [JMAP](http://jmap.io) spec for communicating with the server, but you could also easily build one to use HTTP REST, or
    even a local IndexDB database.

    There's no backend implemented for this little todo demo, so I've faked one
    (see fixtures.js). However, check the console if you want to see the
    requests the client is making to the server.
*/
const source = new Connection({
    url: '/api/',
});

/*
    We tell the source how to fetch, create, modify etc. TodoLists.
*/
source.handle(TodoList, {
    'precedence': 1,
    'fetch': 'TodoList',
    'commit': 'TodoList',
    // Response handlers
    'TodoList/get'(args, _, reqArgs) {
        const isAll = reqArgs.ids === null;
        this.didFetch(TodoList, args, isAll);
    },
    'TodoList/set'(args) {
        this.didCommit(TodoList, args);
    },
});

/*
    And Todos.
*/
source.handle(Todo, {
    'precedence': 2,
    'fetch': 'Todo',
    'commit': 'Todo',
    // Response handlers
    'Todo/get'(args, _, reqArgs) {
        const isAll = reqArgs.ids === null;
        this.didFetch(Todo, args, isAll);
    },
    'Todo/set'(args) {
        this.didCommit(Todo, args);
    },
});

export { source };
