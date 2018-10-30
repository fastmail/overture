/*global console, setTimeout, clearTimeout, window */


( function () {
const confirmCommit = function ( args ) {
    const result = {};
    if ( args.create ) {
        result.created = Object.zip(
            Object.keys( args.create ),
            Object.keys( args.create ).map( function ( id ) {
                return { id };
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
    return result;
};

const API = {
    'TodoList/get' ( results/*, args*/ ) {
        results.push([ 'TodoList/get', {
            state: 'foo',
            list: [{
                id: 'inbox',
                name: 'Inbox',
            }, {
                id: 'someday',
                name: 'Someday',
            }],
        }]);
    },
    'TodoList/set' ( results, args ) {
        results.push([ 'TodoList/set', confirmCommit( args ) ]);
    },
    'Todo/get' ( results/*, args*/ ) {
        results.push([ 'Todo/get', {
            state: 'foo',
            list: [{
                id: 't1',
                listId: 'inbox',
                precedence: 32,
                summary: 'Open OvertureJS Todo demo app',
                isComplete: true,
                dueBy: null,
            }, {
                id: 't2',
                listId: 'inbox',
                precedence: 64,
                summary: 'Drag & drop to reorder',
                isComplete: false,
                dueBy: new Date().add( 1, 'day' ).toJSON(),
            }, {
                id: 't3',
                listId: 'inbox',
                precedence: 96,
                summary: 'Up/down or j/k to change focus',
                isComplete: false,
                dueBy: null,
            }, {
                id: 't4',
                listId: 'inbox',
                precedence: 128,
                summary: 'Hit tab to edit',
                isComplete: false,
                dueBy: new Date().add( 1, 'week' ).toJSON(),
            }, {
                id: 't5',
                listId: 'inbox',
                precedence: 128,
                summary: 'Hit enter to create a new todo',
                isComplete: false,
                dueBy: null,
            }, {
                id: 't6',
                listId: 'inbox',
                precedence: 128,
                summary: 'Hit space to toggle isComplete',
                isComplete: false,
                dueBy: null,
            }, {

                id: 't7',
                listId: 'inbox',
                precedence: 160,
                summary: 'Cmd-Z for undo, Cmd-Shift-Z for redo',
                isComplete: false,
                dueBy: null,
            }],
        }]);
    },
    'Todo/set' ( results, args ) {
        results.push([ 'Todo/set', confirmCommit( args ) ]);
    },
};

// ---

const evaluatePointer = function ( value, pointer ) {
    if ( !pointer ) {
        return value;
    }
    if ( pointer.charAt( 0 ) !== '/' ) {
        throw new Error( 'Invalid pointer' );
    }
    let token;
    const next = pointer.indexOf( '/', 1 );
    if ( next !== -1 ) {
        token = pointer.slice( 1, next );
        pointer = pointer.slice( next );
    } else {
        token = pointer.slice( 1 );
        pointer = '';
    }
    token = token.replace( /~1/g, '/' ).replace( /~0/g, '~' );
    if ( Array.isArray( value ) ) {
        if ( /^(?:0|[1-9][0-9]*)$/.test( token ) ) {
            return evaluatePointer( value[ parseInt( token, 10 ) ], pointer );
        }
        /* start: the only bit that differs from RFC6901 */
        if ( token === '*' ) {
            /* Map values to pointer */
            value = value.map( item => evaluatePointer( item, pointer ) );
            /* Flatten output */
            return value.reduce( ( output, item ) => {
                if ( !Array.isArray( item ) ) {
                    item = [ item ];
                }
                return output.concat( item );
            }, [] );
        }
        /* end */
    } else if ( value !== null && typeof value === 'object' ) {
        return evaluatePointer( value[ token ], pointer );
    }
    throw new Error( 'Evaluation failed' );
};

const resolveBackRefs = function ( args, results ) {
    for ( const property in args ) {
        if ( property.charAt( 0 ) === '#' ) {
            const resultOf = args[ property ].resultOf;
            const path = args[ property ].path;
            const result = results.find( result => result[2] === resultOf );
            args[ property.slice( 1 ) ] = result ?
                evaluatePointer( result[1], path ) :
                [];
        }
    }
    return args;
};

// ---

const XMLHttpRequest = function () {
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
// Random delay between 200 and 700 ms.
XMLHttpRequest.prototype.send = function ( data ) {
    if ( this._url === '/.well-known/jmap' ) {
        this.responseText = JSON.stringify({
            'username': '',
            'accounts': {
                'ACCOUNT ID': {
                    'name': '',
                    'isPersonal': false,
                    'isReadOnly': false,
                    'hasDataFor': [
                        'http://overturejs.com/examples/Todo',
                    ],
                },
            },
            'primaryAccounts': {
                'http://overturejs.com/examples/Todo': 'ACCOUNT ID',
            },
            'capabilities': {
                'http://overturejs.com/examples/Todo': {},
                'urn:ietf:params:jmap:core': {
                    'maxSizeUpload': 0,
                    'maxConcurrentUpload': 10,
                    'maxSizeRequest': 10000000,
                    'maxConcurrentRequests': 10,
                    'maxCallsInRequest': 64,
                    'maxObjectsInGet': 1000,
                    'maxObjectsInSet': 1000,
                    'collationAlgorithms': [
                        'i;ascii-numeric',
                        'i;ascii-casemap',
                        'i;octet',
                    ],
                },
            },
            'apiUrl': '/jmap/api/',
            'downloadUrl':
                '/jmap/download/{accountId}/{blobId}/{name}?accept={type}',
            'uploadUrl': '/jmap/upload/{accountId}/',
            'eventSourceUrl': '/jmap/event/',
            'state': '',
        });
        return;
    }
    if ( data !== null ) {
 console.log( this._method, this._url, data );
}
    if ( this._url === '/log/error/' ) {
        console.log( data );
        return;
    }
    const that = this;
    this._request = setTimeout( function () {
        that._returnResultForData( data );
    }, ~~( Math.random() * 500 ) + 200 );
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
    return 'IsLocal: True';
};
XMLHttpRequest.prototype._returnResultForData = function ( data ) {
    this.readyState = 4;
    let methods = [];
    try {
        methods = JSON.parse( data ).methodCalls || [];
    } catch ( error ) {}
    const result = [];
    const methodsLength = methods.length;
    let k = 0;
    for ( let i = 0; i < methodsLength; i += 1 ) {
        const call = methods[i];
        const method = call[0];
        let args = call[1];
        const tag = call[2];
        const accountId = args.accountId;

        args = resolveBackRefs( args, result );
        if ( API[ method ] ) {
            API[ method ]( result, args );
        }

        const resultLength = result.length;
        for ( ; k < resultLength; k += 1 ) {
            result[k][1].accountId = accountId;
            result[k][2] = tag;
        }
    }
    // Simulate 10% errors:
    // this.status = Math.random() > 0.9 ? 400 : 200;
    this.status = 200;
    this.response = { methodResponses: result };
    // console.log( JSON.stringify( result, null, 2 ) );
    this.onreadystatechange();
};

window.XMLHttpRequest = XMLHttpRequest;
}() );
