/*global require, process, console */

"use strict";

var fs = require( 'fs' );
var less = require( 'less' );
var csstools = require( './csstools.js' );

var replaceFileNames = function ( names, input, output ) {
    var map = {};
    names.forEach( function ( name ) {
        name = name.replace( /.*\//, '' );
        var hyphen = name.lastIndexOf( '-' );
        if ( hyphen !== -1 ) {
            var basename = name.slice( 0, hyphen ) + name.slice( hyphen + 9 );
            map[ basename ] = name;
        }
    });
    fs.readFile( input, 'utf8', function ( error, data ) {
        if ( !error ) {
            for ( var name in map ) {
                data = data.replace(
                    new RegExp( '\\${' + name + '}', 'g' ), map[ name ] );
            }
            fs.writeFile( output, data );
        }
    });
};

var addModuleList = function ( variable, modules, input, output ) {
    var data = fs.readFileSync( input, 'utf8' );
    
    data = data.replace( '// ' + variable,
            modules.reduce( function ( prev, name ) {
        return prev + '"' + name + '": "${' + name + '.js}",\n';
    }, '' ).slice( 0, -2 ) );
    
    fs.writeFile( output, data );
};

var stripStrict = function ( string ) {
    return string.replace( /^\s*"use strict"[;,]\n?/m, '' );
};

Array.prototype.include = function ( item ) {
    var i, l;
    for ( i = 0, l = this.length; i < l; i += 1 ) {
        if ( this[i] === item ) {
            return this;
        }
    }
    this[l] = item;
    return this;
};

var groupIntoModules = function ( files ) {
    var modules = {};
    files.forEach( function ( file ) {
        var moduleName = file.module;
        if ( !moduleName ) {
            throw new Error( 'File ' + file.src + ' belongs to no module!' );
        }
        var module = modules[ moduleName ] = ( modules[ moduleName ] || {
            name: moduleName,
            dependencies: [],
            files: []
        });
        module.files.push( file );
        file.dependencies = file.dependencies.filter( function ( dependency ) {
            if ( dependency.slice( -3 ) !== '.js' ) {
                module.dependencies.include( dependency );
                return false;
            }
            return true;
        });
    });
    var result = [];
    for ( var m in modules ) {
        result.push( modules[m] );
    }
    return result;
};

var sort = function ( array ) {
    var tree = {};
    array.forEach( function ( obj ) {
        tree[ obj.name ] = {
            obj: obj
        };
    });
    array.forEach( function ( obj ) {
        tree[ obj.name ].dependencies =
                obj.dependencies.map( function ( name ) {
            var dependency = tree[ name ];
            if ( !dependency ) {
                console.log( obj.name + ' requires ' + name +
                    ' but we do not have it!' );
            }
            return dependency;
        });
    });
    var result = [];
    var output = function output( node ) {
        if ( node.isOutput ) { return; }
        node.dependencies.forEach( function ( dependency ) {
            output( dependency );
        });
        node.isOutput = true;
        result.push( node.obj );
    };
    for ( var key in tree ) {
        if ( tree.hasOwnProperty( key ) ) {
            output( tree[ key ] );
        }
    }
    return result;
};

var sortByDependencies = function ( files ) {
    var parsers = {
        name: /^\/\/\sFile:([^\\]+)\\\\$/m,
        module: /^\/\/\sModule:([^\\]+)\\\\$/m,
        dependencies: /^\/\/\sRequires:([^\\]+)\\\\$/m
    };
    var parsed = files.map( function ( file ) {
        var info = {
            data: file
        };
        for ( var attr in parsers ) {
            var value = parsers[ attr ].exec( file ) || '';
            // Get first capture group and clean it.
            if ( value ) { value = value[1].replace( /\s/g, '' ); }
            if ( attr === 'dependencies' ) {
                value = value ? value.split( ',' ) : [];
            }
            info[ attr ] = value;
        }
        return info;
    });
    var modules = sort( groupIntoModules( parsed ) );
    
    return modules.reduce( function ( array, module ) {
        sort( module.files ).forEach( function ( file ) {
            array.push( file.data );
        });
        return array;
    }, [] );
};

var makeModule = function ( themeManager, theme, inputs, output ) {
    // Always keep in the same order.
    inputs.sort();
    // 1. Divide by type
    var images = inputs.filter( function ( input ) {
        return ( /\.(?:png|jpe?g|gif)$/i.test( input ) );
    });
    var css = inputs.filter( function ( input ) {
        return ( /\.css$/i.test( input ) );
    });
    var js = inputs.filter( function ( input ) {
        return ( /\.js$/i.test( input ) );
    });
    var module = '"use strict";\n\n';
    images.forEach( function ( input ) {
        var data = fs.readFileSync( input );
        var filename = input.replace( /.*\//, '' );
        var type = filename.slice( filename.lastIndexOf( '.' ) + 1 );
        if ( type === 'jpg' ) { type = 'jpeg'; }
        
        module += themeManager;
        module += '.imageDidLoad("';
        module += theme;
        module += '", "';
        module += filename;
        module += '", "data:image/';
        module += type;
        module += ';base64,';
        module += data.toString( 'base64' );
        module += '");\n';
    });
    css.forEach( function ( input ) {
        var data = fs.readFileSync( input, 'utf8' );
        var filename = input.replace( /.*\//, '' );
        
        data = data.replace( /url\(\s*["']?(.*?)["']?\s*\)/g,
                    function ( original, img ) {
               return /data:/.test( img ) ?
                    original :
                    'url(' + img.replace( /.*\//g, '' ) + ')';
        });
        data = csstools.minify( data );
        module += themeManager;
        module += '.stylesheetDidLoad("';
        module += theme;
        module += '", "';
        module += filename.replace( /\.[^.]+$/, '' );
        module += '", "';
        module += data.replace( /\\/g, '\\\\' ).replace( /"/g, '\\"' );
        module += '");\n';
    });
    
    var jsData = js.map( function ( input ) {
        return stripStrict( fs.readFileSync( input, 'utf8' ) );
    });
    
    module += sortByDependencies( jsData ).join( '\n\n' );
    
    fs.writeFile( output, module );
};

( function () {
    var args = process.argv.slice( 2 );
    switch ( args[0] ) {
        case 'replaceFileNames':
            replaceFileNames(
                args.slice( 1, -2 ),
                args[ args.length - 2 ],
                args[ args.length - 1 ]
            );
            break;
        case 'addModuleList':
            addModuleList(
                args[1],
                args.slice( 2, -2 ),
                args[ args.length - 2 ],
                args[ args.length - 1 ]
            );
            break;
        case 'makeModule':
            makeModule(
                args[1],
                args[2],
                args.slice( 3, -1 ),
                args[ args.length - 1 ]
            );
    }
}() );