/*global document, setTimeout, XMLHttpRequest, XDomainRequest, localStorage, O*/

/*
    Object: O.Loader

    The Loader class handles loading in modules as and when they're
    needed.
*/
const UNREQUESTED = 0;
const LOADING = 1;
const LOADED = 2;
const WILL_EXECUTE = 4;
const EXECUTED = 8;

const LS_PREFIX = 'OResource-';
const LS_V_PREFIX = 'OResource-v-';

const moduleInfo = {};
// We get the choice of whether we offend no-use-before-define or prefer-const.
// Frankly no-use-before-define would probably be better, but this way we only
// have to twiddle the switch once…
let require;  // eslint-disable-line prefer-const
let loader;  // eslint-disable-line prefer-const

const CORSRequest =
    ( 'withCredentials' in new XMLHttpRequest() ) ? XMLHttpRequest :
    ( typeof XDomainRequest !== 'undefined' ) ? XDomainRequest : null;

const getFile = function ( src, callback ) {
    const xhr = new CORSRequest();
    const send = function () {
        xhr.open( 'GET', src );
        xhr.send();
    };
    let wait = 1000;
    xhr.onload = function () {
        const status = xhr.status;
        if ( status !== 200 ) {
            // (onLoadFailed is accessed as a property so it can be overridden.)
            const action = loader.onLoadFailed( status, xhr.statusText );
            if ( action === 'retry' ) {
                xhr.onerror();
            }
            return;
        }
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
const inOrderScripts = ( CORSRequest === XMLHttpRequest );

let afterModuleExecute = function ( name ) {
    const info = moduleInfo[ name ];
    const callbacks = info.callbacks;

    if ( loader.fire ) {
        loader.fire( 'loader:didLoadModule', { module: name } );
    } else if ( O.meta ) {
        Object.assign( loader, O.EventTarget );
        afterModuleExecute = afterModuleExecute.invokeInRunLoop();
    }
    info.status = EXECUTED;

    if ( callbacks ) {
        for ( let i = 0, l = callbacks.length; i < l; i += 1 ) {
            const callback = callbacks[i];
            if ( !( callback.refCount -= 1 ) ) {
                const fn = callback.fn;
                const bind = callback.bind;
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

const executeModule = function ( name ) {
    // If inside an event handler from a different context (i.e. an
    // iframe), Opera will sometimes get into a weird internal state
    // if you execute the code immediately, so delay to the next
    // event loop.
    const info = moduleInfo[ name ];
    const data = info.data;
    setTimeout( function () {
        // `eval` would execute in the local scope. `( 1, eval )` is global.
        // eslint-disable-next-line no-eval
        ( 1, eval )( data );
        afterModuleExecute( name, info );
    }, 0 );
    info.data = null;
};

const checkAndExecuteModule = function ( name ) {
    const info = moduleInfo[ name ];
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

const moduleDidLoad = function ( name, data ) {
    const info = moduleInfo[ name ];
    const currentStatus = info.status;

    info.data = data;
    info.status = LOADED;

    if ( currentStatus & WILL_EXECUTE ) {
        checkAndExecuteModule( name );
    }
};

// Loads text, but does not parse/execute unless executeOnLoad is set.
const load = function ( name, executeOnLoad, force ) {
    const info = moduleInfo[ name ];
    const src = info.src;
    const status = info.status;
    const useScriptTag = !CORSRequest || loader.debug;

    if ( useScriptTag ) {
        if ( !executeOnLoad ) {
            return;
        }
        const dependencies = info.dependencies;
        if ( !inOrderScripts && !force &&
                dependencies ) {
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
                const data = localStorage.getItem( LS_PREFIX + name );
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
            const doc = document;
            const script = doc.createElement( 'script' );
            script.type = 'text/javascript';
            script.charset = 'utf-8';
            script.async = false;
            script.onload = script.onreadystatechange = function () {
                const readyState = script.readyState;
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
                const data = response + '\n//# sourceURL=' + src;
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

    let allLoaded = true;
    let l = modules.length;
    let waitObj;

    while ( l-- ) {
        const module = modules[l];
        const info = moduleInfo[ module ];

        if ( info.status !== EXECUTED ) {
            allLoaded = false;

            // Push callback onto stack for module
            if ( fn ) {
                if ( !waitObj ) {
                    waitObj = {
                        fn,
                        bind,
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
            const dependencies = info.dependencies;
            if ( dependencies ) {
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
loader = {
    debug: false,
    cacheModules: false,
    modules: moduleInfo,
    baseHref: '',

    /*
        Function: O.loader.onLoadFailed

        This method is called when loading a code module produces an
        unsuccessful HTTP response (that is, the request is successful, but the
        status code is something other than 200 OK—for example, it might be 404
        Not Found because the code was removed from the server, or 503 Service
        Unavailable because the server is down for maintenance). Note that if
        the actual request fails (e.g. network failure) it will retry
        automatically without invoking this function.

        Users of Overture are at liberty ot replace this function with one of
        their own to change the behaviour.

        Arguments:

            status     - {integer} The HTTP status of the unsuccessful request.
                         It will be something other than 200.
            statusText - {String} The statusText from the XMLHttpRequest.

        Returns:

            {undefined | 'retry'} If you want to try the request again (possibly
                                  useful for 502, 503 or 504), return 'retry'.
    */
    onLoadFailed ( status, statusText ) {
        if ( status === 502 || status === 503 || status === 504 ) {
            return 'retry';
        }
        const reloadPage = confirm(  // eslint-disable-line no-alert
            'Loading code failed (reason: ' + status + ' ' + statusText +
            '). Reloading the page is probably necessary. Shall we try that?' );
        if ( reloadPage ) {
            // forceReload = true, to help make sure we get a fresh bootstrap.
            location.reload( true );
        }
    },

    getFile,

    register ( name, info ) {
        if ( !info.status ) {
            info.status = info.src ? UNREQUESTED : LOADED;
        }
        info.src = this.baseHref + info.src;
        moduleInfo[ name ] = info;
        return this;
    },

    prefetch ( name ) {
        const info = moduleInfo[ name ];
        const dependencies = info.dependencies;
        let l = dependencies ? dependencies.length : 0;
        while ( l-- ) {
            load( dependencies[l] );
        }
        load( name );
        return this;
    },
    // Requires all modules listed.
    // Returns whether loaded.
    // Presuming all dependency chains resolved.
    require,
};

export { loader, require };
