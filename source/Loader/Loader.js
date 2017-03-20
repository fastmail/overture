// -------------------------------------------------------------------------- \\
// File: Loader.js                                                            \\
// Module: Loader                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global document, setTimeout, XMLHttpRequest, XDomainRequest, localStorage, O */

/*
    Object: O.Loader

    The Loader class handles loading in modules as and when they're
    needed.
*/
var UNREQUESTED = 0,
    LOADING = 1,
    LOADED = 2,
    WILL_EXECUTE = 4,
    EXECUTED = 8;

var LS_PREFIX = 'OResource-';
var LS_V_PREFIX = 'OResource-v-';

var moduleInfo = {};
var require;

var CORSRequest =
    ( 'withCredentials' in new XMLHttpRequest() ) ? XMLHttpRequest :
    ( typeof XDomainRequest !== 'undefined' ) ? XDomainRequest : null;

var getFile = function ( src, callback ) {
    var xhr = new CORSRequest(),
        send = function () {
            xhr.open( 'GET', src );
            xhr.send();
        },
        wait = 1000;
    xhr.onload = function () {
        xhr.onload = xhr.onerror = null;
        callback( this.responseText );
    };
    xhr.onerror = function () {
        setTimeout( send, wait = Math.min( wait * 2, 32000 ) );
    };
    // IE randomly aborts some requests if these handlers aren't set.
    xhr.onprogress = function () {};
    xhr.ontimeout = function () {};
    setTimeout( send, 0 );
};

// Will the browser execute the scripts in the order they are injected into the
// page?
var inOrderScripts = ( CORSRequest === XMLHttpRequest );

var afterModuleExecute = function ( name ) {
    var info = moduleInfo[ name ],
        callbacks = info.callbacks,
        i, l, callback, fn, bind;

    if ( loader.fire ) {
        loader.fire( 'loader:didLoadModule', { module: name } );
    } else if ( O.meta ) {
        O.extend( loader, O.EventTarget );
        afterModuleExecute = afterModuleExecute.invokeInRunLoop();
    }
    info.status = EXECUTED;

    if ( callbacks ) {
        for ( i = 0, l = callbacks.length; i < l; i += 1 ) {
            callback = callbacks[i];
            if ( !( callback.refCount -= 1 ) ) {
                fn = callback.fn;
                bind = callback.bind;
                if ( bind ) {
                    fn.call( bind );
                } else {
                    fn();
                }
            }
        }
    }
    info.callbacks = null;
};

var executeModule = function ( name ) {
    // If inside an event handler from a different context (i.e. an
    // iframe), Opera will sometimes get into a weird internal state
    // if you execute the code immediately, so delay to the next
    // event loop.
    var info = moduleInfo[ name ],
        data = info.data;
    setTimeout( function () {
        // `eval` would execute in the local scope. `( 1, eval )` is global.
        // eslint-disable-next-line no-eval
        ( 1, eval )( data );
        afterModuleExecute( name, info );
    }, 0 );
    info.data = null;
};

var checkAndExecuteModule = function ( name ) {
    var info = moduleInfo[ name ];
    if ( info.status === LOADED ) {
        info.status = (LOADED|WILL_EXECUTE);
        if ( info.dependencies ) {
            require( info.dependencies, function () {
                executeModule( name );
            });
        } else {
             executeModule( name );
        }
    }
};

var moduleDidLoad = function ( name, data ) {
    var info = moduleInfo[ name ],
        currentStatus = info.status;

    info.data = data;
    info.status = LOADED;

    if ( currentStatus & WILL_EXECUTE ) {
        checkAndExecuteModule( name );
    }
};

// Loads text, but does not parse/execute unless executeOnLoad is set.
var load = function ( name, executeOnLoad, force ) {
    var info = moduleInfo[ name ],
        src = info.src,
        status = info.status,
        useScriptTag = !CORSRequest || loader.debug,
        dependencies, data, doc, script;

    if ( useScriptTag ) {
        if ( !executeOnLoad ) {
            return;
        }
        if ( !inOrderScripts && !force &&
                ( dependencies = info.dependencies ) ) {
            require( dependencies, function () {
                load( name, executeOnLoad, true );
            });
            return;
        }
    }

    if ( status === UNREQUESTED ) {
        // Set new status
        info.status = executeOnLoad ? (LOADING|WILL_EXECUTE) : LOADING;
        if ( executeOnLoad && loader.fire ) {
            loader.fire( 'loader:willLoadModule', { module: name } );
        }

        // Check local storage for module data
        if ( loader.cacheModules ) {
            try {
                data = localStorage.getItem( LS_PREFIX + name );
                if ( data ) {
                    if ( localStorage.getItem( LS_V_PREFIX + name ) === src ) {
                        moduleDidLoad( name, data );
                        return;
                    } else {
                        localStorage.removeItem( LS_PREFIX + name );
                        localStorage.removeItem( LS_V_PREFIX + name );
                    }
                }
            } catch ( error ) {}
        }

        // If not found, request.
        if ( useScriptTag ) {
            doc = document;
            script = doc.createElement( 'script' );
            script.type = 'text/javascript';
            script.charset = 'utf-8';
            script.async = false;
            script.onload = script.onreadystatechange = function () {
                var readyState = script.readyState;
                if ( readyState &&
                        readyState !== 'loaded' && readyState !== 'complete' ) {
                    return;
                }
                script.onload = script.onreadystatechange = null;
                script.parentNode.removeChild( script );
                afterModuleExecute( name, info );
            };
            script.src = src;
            doc.documentElement.firstChild.appendChild( script );
        } else {
            getFile( src, function ( response ) {
                var data = response + '\n//# sourceURL=' + src;
                if ( loader.cacheModules ) {
                    try {
                        localStorage.setItem( LS_V_PREFIX + name, src );
                        localStorage.setItem( LS_PREFIX + name, data );
                    } catch ( error ) {}
                }
                moduleDidLoad( name, data );
            });
        }
    } else if ( executeOnLoad && !( status & (WILL_EXECUTE|EXECUTED) ) ) {
        if ( loader.fire ) {
            loader.fire( 'loader:willLoadModule', { module: name } );
        }
        if ( status & LOADING ) {
            info.status = (LOADING|WILL_EXECUTE);
        } else {
            checkAndExecuteModule( name );
        }
    }
};

require = function ( modules, fn, bind ) {
    if ( !( modules instanceof Array ) ) {
         modules = [ modules ];
    }

    var allLoaded = true,
        l = modules.length,
        module, info, dependencies, waitObj;

    while ( l-- ) {
        module = modules[l];
        info = moduleInfo[ module ];

        if ( info.status !== EXECUTED ) {
            allLoaded = false;

            // Push callback onto stack for module
            if ( fn ) {
                if ( !waitObj ) {
                    waitObj = {
                        fn: fn,
                        bind: bind,
                        refCount: 0,
                    };
                }
                waitObj.refCount += 1;
                if ( !info.callbacks ) {
                    info.callbacks = [];
                }
                info.callbacks.push( waitObj );
            }

            // Load module dependencies
            if ( ( dependencies = info.dependencies ) ) {
                require( dependencies );
            }

            // Load this module
            load( module, true );
        }
    }

    // Everything already loaded, synchronously callback the fn.
    if ( allLoaded && fn ) {
        if ( bind ) {
            fn.call( bind );
        } else {
            fn();
        }
    }

    return allLoaded;
};

/*
    Event: loader:willLoadModule

    This event is fired immediately before a new module is requested from
    the server.
*/

/*
    Event: loader:didLoadModule

    This event is fired immediately after a new module finishes
    loading, before any waiting require() functions are called.
*/
var loader = {
    debug: false,
    cacheModules: false,
    modules: moduleInfo,
    baseHref: '',

    getFile: getFile,

    register: function ( name, info ) {
        if ( !info.status ) {
            info.status = info.src ? UNREQUESTED : LOADED;
        }
        info.src = this.baseHref + info.src;
        moduleInfo[ name ] = info;
        return this;
    },

    prefetch: function ( name ) {
        var info = moduleInfo[ name ],
            dependencies = info.dependencies,
            l = dependencies ? dependencies.length : 0;
        while ( l-- ) {
            load( dependencies[l] );
        }
        load( name );
        return this;
    },
    // Requires all modules listed.
    // Returns whether loaded.
    // Presuming all dependency chains resolved.
    require: require,
};

export { loader, require };
