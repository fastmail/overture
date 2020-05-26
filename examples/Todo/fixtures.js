/*global console, setTimeout, clearTimeout, window */
"use strict";

( function () {

var confirmCommit = function ( args, extras ) {
    var result = {};
    if ( args.create ) {
        result.created = Object.zip(
            Object.keys( args.create ),
            Object.keys( args.create ).map( function ( id ) {
                return Object.assign(
                    { id: 'committed' + id.slice( 1 ) }, extras );
            })
        );
    }
    if ( args.update )  {
        result.updated = Object.zip(
            Object.keys( args.update ),
            Object.keys( args.update ).map( function () {
                return null;
            })
        );
    }
    if ( args.destroy ) {
        result.destroyed = args.destroy;
    }
    result.fromAccountId = args.fromAccountId;
    result.toAccountId = args.toAccountId;
    return result;
};

var API = {
    'TodoList/get': function ( results/*, args*/ ) {
        results.push([ 'TodoList/get', {
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
    'TodoList/set': function ( results, args ) {
        results.push([ 'TodoList/set', confirmCommit( args ) ]);
    },
    'Todo/get': function ( results/*, args*/ ) {
        results.push([ 'Todo/get', {
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
    'Todo/set': function ( results, args ) {
        results.push([ 'Todo/set', confirmCommit( args ) ]);
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
        methods = JSON.parse( data ).methodCalls || [];
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
    this.response = { methodResponses: result };
    this.onreadystatechange();
};

window.XMLHttpRequest = XMLHttpRequest;

}() );
