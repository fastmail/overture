import { editStore, TodoList, Todo } from './models.js';
import parseSearch from './parseSearch.js';

const LocalQuery = O.LocalQuery;
const Router = O.Router;
const { DESTROYED, NON_EXISTENT, LOADING, NEW } = O.Status;

/// --- UI State & Routing

/*
    We hold the general application state (as opposed to the data state) in
    this object.
*/
const state = new Router({

    listId: '',
    search: '',

    /* The currently selected TodoList. This is always "Inbox" at the moment,
       but it would be easy to extend the UI to allow you to switch between
       lists.
    */
    list: function () {
        return editStore.getRecord( null, TodoList, this.get( 'listId' ) );
    }.property( 'listId' ),

    /* An observable collection of Todo instances that belong to the currently
       selected TodoList and match any search.

       This is a query on our local store, and will automatically update if the
       data in the store changes.
    */
    todos: function () {
        var listId = this.get( 'listId' ),
            searchTree = parseSearch( this.get( 'search' ) ),
            filter;

        if ( !listId ) {
            return null;
        }

        listId = editStore.getStoreKey( null, TodoList, listId );

        filter = new Function( 'data', 'return' +
            '(data.listId==="' + listId.replace( /"/g, '\\"') + '")' +
            ( searchTree ? '&&' + searchTree.toFunctionString() : '' )
        );

        return new LocalQuery({
            store: editStore,
            Type: Todo,
            sort: function ( a, b ) {
                return ( a.precedence - b.precedence ) ||
                    ( a.id < b.id ? -1 : a.id > b.id ? 1 : 0 );
            },
            where: filter
        });
    }.property( 'listId', 'search' ),

    /* Destroy the previous LocalQuery, as it's no longer needed. In the current
       implementation we're not reusing queries, so we should always destroy
       the old ones, otherwise we will leak memory (and time, as each old
       query is kept up to date!)
    */
    cleanupTodos: function ( _, __, oldQuery ) {
        if ( oldQuery ) {
            oldQuery.destroy();
        }
    }.observes( 'todos' ),

    /* TODO: Use this property to show a loading animation in the list while
       the initial data is loading (irrelevant with fixtures, but important
       if we had a real backend)
    */
    isLoadingList: false,

    /* If the current TodoList is destroyed, go back to the Inbox TodoList
       (we assume this is always present). If we arrived via a URL, we may have
       tried to load a list id that doesn't actually exist; in this case, the
       same behaviour is applied.
    */
    checkListStatus: function ( _, __, ___, status ) {
        if ( status & (DESTROYED|NON_EXISTENT) ) {
            this.set( 'listId', null );
        } else {
            this.set( 'isLoadingList', !!( status & LOADING ) );
        }
    }.observes( 'list.status' ),

    /* If we switch lists, clear any current search.
    */
    clearSearch: function () {
        this.set( 'search', '' );
    }.observes( 'listId' ),

    /* The Todo currently being edited.
    */
    editTodo: null,

    /* When we finish editing a todo, commit the changes back to the source
       (this automatically records an Undo checkpoint as well).
    */
    commitChanges: function ( _, __, oldTodo ) {
        if ( oldTodo !== null ) {
            var status = oldTodo.get( 'status' );
            if ( !oldTodo.get( 'summary' ) ) {
                if ( status & NEW ) {
                    oldTodo.destroy();
                    editStore.commitChanges();
                } else {
                    editStore.discardChanges();
                }
            } else {
                editStore.commitChanges();
            }
        }
    }.observes( 'editTodo' ),

    // Page title

    /* The title of our page (as displayed in the browser window/tab).
    */
    title: function () {
        var appName = 'Overture Todo Example';
        var listName = this.getFromPath( 'list.name' );
        return listName ? listName + ' – ' + appName : appName;
    }.property( 'list' ),

    // URL routing (state encoding/decoding)

    /* To use HTML5 URL rewriting, the router needs to know where the app is
       located relative to the root of the domain. */
    baseUrl: '/examples/Todo/',

    /* This is the URL the browser should show. This is dependent on the current
       selected TodoList, but I've decided not to encode any search in the URL.
    */
    encodedState: function () {
        var listId = this.get( 'listId' );
        if ( listId ) {
            return listId + '/';
        } else {
            return '';
        }
    }.property( 'listId' ),

    /* Routes are simply a regexp to match against the URL (after any base part)
       and then a function to use to restore the state from that URL.

       The handle fns are called in the context of the state object, and
       are supplied with any capture groups in the regexp as arguments 1+.
    */
    routes: [
        {
            url: /^$/,
            handle: function () {
                this.set( 'listId', null );
            }
        },
        {
            url: /^(.*?)\/$/,
            handle: function ( _, listId ) {
                this.set( 'listId', listId );
            }
        },
        // Fallback route; if the user comes in via a nonsense URL, just
        // go to our default view.
        {
            url: /.*/,
            handle: function () {
                /* Don't keep the old state in history */
                this.set( 'replaceState', true );
                this.set( 'listId', null );
            }
        }
    ]
});

// --- Exports

export default state;
