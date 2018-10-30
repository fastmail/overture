import { Connection, auth } from './Connection.js';

const { loc, Class, NestedStore, Record, Status, Store, StoreUndoManager } = O;

// ---

const TODO_SPEC_URI = 'http://overturejs.com/examples/Todo';

// --- Model ---

/*  The source is the connection from the store to the server for fetching
    and modifying records. The JMAP.Connection class automatically uses the
    JSON API format used in the [JMAP](http://jmap.io) spec for communicating with the server, but you could also easily build one to use HTTP REST, or
    even a local IndexDB database.

    There's no backend implemented for this little todo demo, so I've faked one
    (see fixtures.js). However, check the console if you want to see the
    requests the client is making to the server.

    We’re using a limited portion of jmap-js only, which doesn’t concern itself
    with a full session object; hence setting JMAP.auth.apiUrl like this, and
    the hard-coded addAccount call later.
*/

// In a practical deployment, you’d probably seek to embed the JMAP session
// object in the HTML somewhere, to remove the need for another request before
// you can get started. But for this simple demonstration, it is sufficient
// (just barely!) to fetch it synchronously:
var xhr = new XMLHttpRequest();
xhr.open( 'GET', '/.well-known/jmap', false );
xhr.setRequestHeader('Content-type', 'application/json');
xhr.setRequestHeader('Accept', 'application/json');
xhr.send();
var sessionObject = JSON.parse( xhr.responseText );
// auth is stubbed, and we only need apiUrl (here) and the accounts (below)
auth.set( 'apiUrl', sessionObject.apiUrl );

var source = new Connection();
/*  The store instance stores the locally cached copies of the different
    records in the model. It keeps track of what has changed compared to the
    copy received from the source, and can then send those changes to the source
    to be committed. It can keep track of further changes whilst the current
    ones are being committed and resolve things when the commit succeeds or
    fails.

    I've turned off auto-commit, so it will only send changes to the store when
    O.Store#commitChanges is explicitly called. This is because when editing
    todos, the text field is just bound directly to the summary in the model,
    and we don't want it to commit on every keystroke; just when the user has
    finished editing.

    In more complex apps, you would often use an O.NestedStore to create a
    copy-on-write view of the original store. This allows you to edit stuff
    and commit it back independently; I've kept it simpler here.
*/
var store = new Store({
    source: source,
});

var editStore = new NestedStore( store );

var accounts = sessionObject.accounts;
for ( var accountId in accounts ) {
    if ( Object.prototype.hasOwnProperty.call( accounts, accountId ) ) {
        var account = accounts[ accountId ];
        store.addAccount( accountId, {
            isDefault: true,
            hasDataFor: accounts[ accountId ].hasDataFor,
        });
    }
}

/* A StoreUndoManager hooks into the store to provide automatic undo support.
   Each time the store commits changes to the source, the UndoManager
   automatically records an undo checkpoint.
*/
const undoManager = new StoreUndoManager({
    store: editStore,
    maxUndoCount: 10
});

// ---

/*
    A TodoList is simply a name for a collection of todos. All todos belong
    to a single TodoList.

    I ran out of time to build support into the UI for multiple todo lists;
    pull requests welcome!
*/
var TodoList = Class({

    Extends: Record,

    name: Record.attr( String, {
        defaultValue: '',
        validate: function ( propValue/*, propKey, record*/ ) {
            var error = '';
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
TodoList.dataGroup = TODO_SPEC_URI;

/*
    We tell the source how to fetch, create, modify etc. TodoLists.
*/
source.handle( TodoList, {
    precedence: 1,

    fetch: 'TodoList',
    commit: 'TodoList',
    // Response handlers
    'TodoList/get': function ( args, _reqName, reqArgs ) {
        this.didFetch( TodoList, args, reqArgs.ids === null );
    },
    'TodoList/set': function ( args ) {
        this.didCommit( TodoList, args );
    }
});

/* We have brought this in from jmap-js for persisting Date objects into
 * the JMAP data store.  There's no native method (or Overture method) on Date
 * to convert to a JMAP format.  (We keep getting pesky milliseconds.)
 */
const toJSON = function ( date ) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds();

    return (
        ( year < 1000 ?
            '0' + ( year < 100 ? '0' + ( year < 10 ? '0' : '' ) : '' ) + year :
            '' + year ) + '-' +
        ( month < 10 ? '0' + month : '' + month ) + '-' +
        ( day < 10 ? '0' + day : '' + day ) + 'T' +
        ( hour < 10 ? '0' + hour : '' + hour ) + ':' +
        ( minute < 10 ? '0' + minute : '' + minute ) + ':' +
        ( second < 10 ? '0' + second : '' + second )
    );
};

const toUTCJSON = function ( date ) {
    return toJSON( date ) + 'Z';
};

// ---

var Todo = Class({

    Extends: Record,

    list: Record.toOne({
        Type: TodoList,
        key: 'listId'
    }),

    precedence: Record.attr( Number, {
        isNullable: false,
        defaultValue: 0
    }),

    isComplete: Record.attr( Boolean, {
        isNullable: false,
        defaultValue: false
    }),

    summary: Record.attr( String, {
        isNullable: false,
        defaultValue: ''
    }),

    dueBy: Record.attr( Date, {
        isNullable: true,
        toJSON: toUTCJSON,
        defaultValue: null
    }),

    autoCommitIsComplete: function () {
        if ( !( this.get( 'status' ) & Status.NEW ) ) {
            editStore.commitChanges();
        }
    }.observes( 'isComplete' )
});
Todo.dataGroup = TODO_SPEC_URI;

source.handle( Todo, {
    precedence: 2,
    fetch: 'Todo',
    commit: 'Todo',
    // Response handlers
    'Todo/get': function ( args, _reqName, reqArgs ) {
        this.didFetch( Todo, args, reqArgs.ids === null );
    },
    'Todo/set': function ( args ) {
        this.didCommit( Todo, args );
    }
});

// --- Exports

export {
    source,
    store,
    editStore,
    undoManager,
    TodoList,
    Todo,
};
