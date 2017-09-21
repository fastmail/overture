/*global console, setTimeout, clearTimeout, window */
"use strict";

( function () {

var API = {
    getTodoLists: function ( results/*, args*/ ) {
        results.push([ 'todoLists', {
            state: 'foo',
            list: [{
                id: 'inbox',
                name: 'Inbox'
            }, {
                id: 'someday',
                name: 'Someday'
            }]
        }]);
    },
    setTodoLists: function ( results, args ) {
        results.push([ 'todoListsSet', {
            created: Object.zip( Object.keys( args.create ), Object.keys( args.create ) ),
            updated: Object.keys( args.update ),
            destroyed: Object.keys( args.destroy )
        }]);
    },
    getTodos: function ( results/*, args*/ ) {
        results.push([ 'todos', {
            state: 'foo',
            list: [{
                id: 't1',
                listId: 'inbox',
                precedence: 32,
                summary: 'Open OvertureJS Todo demo app',
                isComplete: true,
                start: null
            }, {
                id: 't2',
                listId: 'inbox',
                precedence: 64,
                summary: 'Drag & drop to reorder',
                isComplete: false,
                start: null
            }, {
                id: 't3',
                listId: 'inbox',
                precedence: 96,
                summary: 'Up/down or j/k to change focus',
                isComplete: false,
                start: null
            }, {
                id: 't4',
                listId: 'inbox',
                precedence: 128,
                summary: 'Hit tab to edit',
                isComplete: false,
                start: null
            }, {
                id: 't5',
                listId: 'inbox',
                precedence: 128,
                summary: 'Hit enter to create a new todo',
                isComplete: false,
                start: null
            }, {
                id: 't6',
                listId: 'inbox',
                precedence: 128,
                summary: 'Hit space to toggle isComplete',
                isComplete: false,
                start: null
            }, {

                id: 't7',
                listId: 'inbox',
                precedence: 160,
                summary: 'Cmd-Z for undo, Cmd-Shift-Z for redo',
                isComplete: false,
                start: null
            }]
        }]);
    },
    setTodos: function ( results, args ) {
        results.push([ 'todosSet', {
            created: Object.zip( Object.keys( args.create ), Object.keys( args.create ) ),
            updated: Object.keys( args.update ),
            destroyed: Object.keys( args.destroy )
        }]);
    },
};

var XMLHttpRequest = function () {
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.responseText = '';
    this.responseXML = null;
    this.onreadystatechange = function () {};
};
XMLHttpRequest.prototype.open = function ( method, url ) {
    this._method = method;
    this._url = url;
};
XMLHttpRequest.prototype.setRequestHeader = function (/* name, value */) {
    // console.log( 'Request header: ' + name + ' = ' + value );
};
// Random delay between 200 and 500 ms.
XMLHttpRequest.prototype.send = function ( data ) {
    if ( data !== null ) { console.log( data ); }
    if ( this._url === '/log/error/' ) {
        console.log( data );
        return;
    }
    var that = this;
    this._request = setTimeout( function () {
        that._returnResultForData( data );
    }, 10 );
};
XMLHttpRequest.prototype.abort = function () {
    clearTimeout( this._request );
    XMLHttpRequest.call( this );
};
XMLHttpRequest.prototype.getResponseHeader = function ( name ) {
    if ( name === 'Content-type' ) {
        return 'application/json';
    }
};
XMLHttpRequest.prototype.getAllResponseHeaders = function () {
    return "IsLocal: True";
};
XMLHttpRequest.prototype._returnResultForData = function ( data ) {
    var methods = [];
    try {
        methods = JSON.parse( data ) || [];
    } catch ( error ) {}
    var result = [],
        k = 0, kk;
    for ( var i = 0, l = methods.length; i < l; i += 1 ) {
        var method = methods[i];
        if ( API[ method[0] ] ) {
            API[ method[0] ]( result, method[1] );
        }
        for ( kk = result.length; k < kk; k += 1 ) {
            result[k][2] = method[2];
        }
    }
    this.readyState = 4;
    this.status = 200;
    this.response = result;
    this.onreadystatechange();
};

window.XMLHttpRequest = XMLHttpRequest;

}() );
