// -------------------------------------------------------------------------- \\
// File: Loader.js                                                            \\
// Module: Loader                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global window, document, location, setTimeout, XMLHttpRequest, localStorage */

"use strict";

var O = this.O || {};

( function ( NS, XMLHttpRequest ) {

/*
    Object: O.Loader
    
    The Loader class handles loading in modules as and when they're
    needed.
*/
var UNREQUESTED = 0,
    LOADING = 1,
    LOADING_WILL_EXECUTE = 2,
    LOADED = 4,
    LOADED_WILL_EXECUTE = 8,
    EXECUTED = 16;

var ls = localStorage;
var LS_PREFIX = 'OResource-';
var LS_V_PREFIX = 'OResource-v-';

var isLocal = location.protocol === 'file:';

var fullLibLoaded = false;

var loader = {
    
    _modules: {},
    
    debug: false,
    
    cacheModules: false,
    
    registerModule: function ( module, options ) {
        if ( !options.status ) {
            options.status = options.path ? UNREQUESTED : LOADED;
        }
        this._modules[ module ] = options;
        return this;
    },
    
    getModule: function ( module ) {
        return this._modules[ module ];
    },
    
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
    
    prefetch: function ( module ) {
        var info = this._modules[ module ],
            dependencies = info.dependencies,
            l = dependencies ? dependencies.length : 0;
        while ( l-- ) {
            this.load( dependencies[l] );
        }
        return this.load( module );
    },
    
    // Requires all modules listed.
    // Returns whether loaded.
    // Presuming all dependency chains resolved.
    require: function ( modules, fn, bind ) {
        if ( !( modules instanceof Array ) ) {
             modules = [ modules ];
        }
        
        var allLoaded = true,
            l = modules.length,
            module, info, dependencies, waitObj, j;
        
        while ( l-- ) {
            module = modules[l];
            info = this._modules[ module ];
            if ( info.status !== EXECUTED ) {
                allLoaded = false;
                if ( fn ) {
                    if ( !waitObj ) {
                        waitObj = {
                            fn: fn,
                            bind: bind,
                            refCount: 0
                        };
                    }
                    waitObj.refCount += 1;
                    if ( !info.callbacks ) {
                        info.callbacks = [];
                    }
                    info.callbacks.push( waitObj );
                }
                
                if ( dependencies = info.dependencies ) {
                    j = dependencies.length;
                    while ( j-- ) {
                        this.load( dependencies[j], true );
                    }
                }
                this.load( module, true );
            }
        }
        // Everything already loaded, synchronously callback the fn.
        if ( allLoaded && fn ) { fn.call( bind ); }
        
        return allLoaded;
    },
    
    // Loads text, but does not parse/execute unless executeOnLoad is set.
    load: function ( module, executeOnLoad ) {
        var info = this._modules[ module ],
            path = info.path,
            status = info.status,
            data;
        if ( status === UNREQUESTED ) {
            info.status = executeOnLoad ? LOADING_WILL_EXECUTE : LOADING;
            if ( executeOnLoad && this.fire ) {
                this.fire( 'loader:willLoadModule', { module: module } );
            }
            if ( this.cacheModules ) {
                data = ls.getItem( LS_PREFIX + module );
                if ( data ) {
                    if ( ls.getItem( LS_V_PREFIX + module ) === path ) {
                        setTimeout( function () {
                            loader._moduleDidLoad( module, data );
                        }, 0 );
                        return this;
                    } else {
                        ls.removeItem( LS_PREFIX + module );
                        ls.removeItem( LS_V_PREFIX + module );
                    }
                }
            }
            var xhr = new XMLHttpRequest(),
                send = function () {
                    xhr.open( 'GET', path );
                    xhr.send();
                },
                wait = 1;
            xhr.onreadystatechange = function () {
                if ( this.readyState === 4 ) {
                    var status = this.status;
                    // IE8 translates response code 204 to 1223
                    if ( status === 1223 ) { status = 204; }
                    // Local file requests do not return a status code.
                    if ( isLocal && !status ) { status = 200; }
                    if ( 200 <= status && status < 300 ) {
                        this.onreadystatechange = function () {};
                        var data = this.responseText +
                            '\n//@ sourceURL=' + path;
                        if ( loader.cacheModules ) {
                            try {
                                ls.setItem( LS_V_PREFIX + module, path );
                                ls.setItem( LS_PREFIX + module, data );
                            } catch ( e ) {}
                        }
                        loader._moduleDidLoad( module, data );
                    } else {
                        setTimeout( send, wait = Math.min( wait * 2, 32 ) );
                    }
                }
            };
            send();
        } else if ( executeOnLoad &&
                ( status === LOADING || status === LOADED ) ) {
            if ( this.fire ) {
                this.fire( 'loader:willLoadModule', { module: module } );
            }
            if ( status === LOADING ) {
                info.status = LOADING_WILL_EXECUTE;
            } else {
                this._checkAndExecuteModule( module );
            }
        }
        return this;
    },
    
    _moduleDidLoad: function ( module, data ) {
        var info = this._modules[ module ],
            currentStatus = info.status;
        
        info.data = data;
        info.status = LOADED;
        
        if ( currentStatus === LOADING_WILL_EXECUTE ) {
            this._checkAndExecuteModule( module );
        }
    },
    
    _checkAndExecuteModule: function ( module ) {
        var info = this._modules[ module ],
            dependencies = info.dependencies,
            l = dependencies ? dependencies.length : 0;
    
        if ( info.status === LOADED ) {
            info.status = LOADED_WILL_EXECUTE;
            if ( l ) {
                this.require( dependencies, function () {
                    this._executeModule( module );
                }, this );
            } else {
                 this._executeModule( module );
            }
        }
    },
    
    _executeModule: function ( module ) {
        var doc = document,
            head = doc.documentElement.firstChild,
            info = this._modules[ module ],
            data = info.data,
            script;
        
        if ( data ) {
            if ( this.debug ) {
                script = doc.createElement( 'script' );
                script.type = 'text/javascript';
                script.charset = 'utf-8';
                script.src = info.path;
                script.async = false;
                script.onload = script.onreadystatechange = function () {
                    head.removeChild( script );
                    script.onload = script.onreadystatechange = null;
                    loader._afterModuleExecute( module, info );
                };
                head.appendChild( script );
            } else {
                // If inside an event handler from a different context (i.e. an
                // iframe), Opera will sometimes get into a weird internal state
                // if you execute the code immediately, so delay to the next
                // event loop.
                setTimeout( function () {
                    NS.execute( data );
                    loader._afterModuleExecute( module, info );
                }, 0 );
            }
            delete info.data;
        } else {
            this._afterModuleExecute( module, info );
        }
    },
    
    _afterModuleExecute: function ( module, info ) {
        var callbacks = info.callbacks,
            i, l, callback;
        
        if ( !fullLibLoaded && NS.meta ) {
            NS.extend( loader, NS.Events );
            loader._afterModuleExecute =
                loader._afterModuleExecute.invokeInRunLoop();
            fullLibLoaded = true;
        }
        
        if ( this.fire ) {
            this.fire( 'loader:didLoadModule', { module: module } );
        }
        
        if ( callbacks ) {
            for ( i = 0, l = callbacks.length; i < l; i += 1 ) {
                callback = callbacks[i];
                if ( !( callback.refCount -= 1 ) ) {
                    callback.fn.call( callback.bind );
                }
            }
        }
        info.callbacks = null;
        info.status = EXECUTED;
    }
};

NS.loader = loader;
NS.require = function ( modules, fn, bind ) {
    return loader.require( modules, fn, bind );
};

}( O, XMLHttpRequest ) );

O.execute = ( function () {
    var isGlobal = function ( original, Object ) {
        try {
            // Does `Object` resolve to a local variable, or to a global,
            // built-in `Object`, reference to which we passed as a first
            // argument?
            return ( 1, eval )( 'Object' ) === original;
        }
        catch ( e ) {
            // If indirect eval errors out (as allowed per ES3), then just bail
            // out with `false`
            return false;
        }
    }( Object, 1 );

    return isGlobal ?
        /*jshint evil: true */
        function ( code ) {
            ( 1, eval )( code );
        } : window.execScript ?
        function ( code ) {
            window.execScript( code );
        } :
        /*jshint evil: false */
        function ( code ) {
            var doc = document,
                head = doc.documentElement.firstChild,
                script = doc.createElement( 'script' );
            script.type = 'text/javascript';
            script.charset = 'utf-8';
            script.text = code;
            head.appendChild( script );
            head.removeChild( script );
        };
}() );