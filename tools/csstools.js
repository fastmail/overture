// CSS Tools

var less = require( 'less' );
var fs = require( 'fs' );
var sys = require('sys');

var CleanCSS = {
  colors: {
    white: '#fff',
    black: '#000',
    fuchsia: '#f0f',
    yellow: '#ff0'
  },
  
  process: function(data) {
    var specialComments = [],
      contentBlocks = [];

    // replace function
    var replace = function(pattern, replacement) {
      data = data.replace(pattern, replacement);
    };
    
    // strip comments one by one
    for (var end = 0; end < data.length; ) {
      var start = data.indexOf('/*', end);
      end = data.indexOf('*/', start);
      if (start == -1 || end == -1) break;
      
      if (data[start + 2] == '!') {
        // in case of special comments, replace them with a placeholder
        specialComments.push(data.substring(start, end + 2));
        data = data.substring(0, start) + '__CSSCOMMENT__' + data.substring(end + 2);
      } else {
        data = data.substring(0, start) + data.substring(end + 2);
      }
      end = start;
    }
    
    // replace content: with a placeholder
    for (var end = 0; end < data.length; ) {
      var start = data.indexOf('content', end);
      if (start == -1) break;
      
      var wrapper = /[^ :]/.exec(data.substring(start + 7))[0];
      if (/['"]/.test(wrapper) == false) {
        end = start + 7;
        continue;
      }

      var firstIndex = data.indexOf(wrapper, start);
      var lastIndex = data.indexOf(wrapper, firstIndex + 1);
      
      contentBlocks.push(data.substring(firstIndex, lastIndex + 1));
      data = data.substring(0, firstIndex) + '__CSSCONTENT__' + data.substring(lastIndex + 1);
      end = lastIndex + 1;
    }
    
    replace(/;\s*;+/g, ';') // whitespace between semicolons & multiple semicolons
    replace(/\n/g, '') // line breaks
    replace(/\s+/g, ' ') // multiple whitespace
    replace(/ !important/g, '!important') // whitespace before !important
    replace(/[ ]?,[ ]?/g, ',') // space with a comma
    replace(/progid:[^(]+\(([^\)]+)/g, function(match, contents) { // restore spaces inside IE filters (IE 7 issue)
      return match.replace(/,/g, ', ');
    })
    replace(/ ([+~>]) /g, '$1') // replace spaces around selectors
    replace(/\{([^}]+)\}/g, function(match, contents) { // whitespace inside content
      return '{' + contents.trim().replace(/(\s*)([;:=\s])(\s*)/g, '$2') + '}';
    })
    replace(/;}/g, '}') // trailing semicolons
    replace(/rgb\s*\(([^\)]+)\)/g, function(match, color) { // rgb to hex colors
      var parts = color.split(',');
      var encoded = '#';
      for (var i = 0; i < 3; i++) {
        var asHex = parseInt(parts[i], 10).toString(16);
        encoded += asHex.length == 1 ? '0' + asHex : asHex;
      }
      return encoded;
    })
    replace(/([^"'=\s])\s*#([0-9a-f]{6})/gi, function(match, prefix, color) { // long hex to short hex
      if (color[0] == color[1] && color[2] == color[3] && color[4] == color[5])
        return (prefix + (/:$/.test(prefix) ? '' : ' ')) + '#' + color[0] + color[2] + color[4];
      else
        return (prefix + (/:$/.test(prefix) ? '' : ' ')) + '#' + color;
    })
    replace(/(color|background):(\w+)/g, function(match, property, colorName) { // replace standard colors with hex values (only if color name is longer then hex value)
      if (CleanCSS.colors[colorName]) return property + ':' + CleanCSS.colors[colorName];
      else return match;
    })
    replace(/color:#f00/g, 'color:red') // replace #f00 with red as it's shorter
    replace(/font\-weight:(\w+)/g, function(match, weight) { // replace font weight with numerical value
      if (weight == 'normal') return 'font-weight:400';
      else if (weight == 'bold') return 'font-weight:700';
      else return match;
    })
    replace(/progid:DXImageTransform\.Microsoft\.(Alpha|Chroma)(\([^\)]+\))([;}'"])/g, function(match, filter, args, suffix) { // IE shorter filters but only if single (IE 7 issue)
      return filter.toLowerCase() + args + suffix;
    })
    replace(/(\s|:)0(px|em|ex|cm|mm|in|pt|pc|%)/g, '$1' + '0') // zero + unit to zero
    replace(/(border|border-top|border-right|border-bottom|border-left|outline):none/g, '$1:0') // none to 0
    replace(/(background):none([;}])/g, '$1:0$2') // background:none to 0
    replace(/0 0 0 0/g, '0') // multiple zeros into one
    replace(/([: ,=\-])0\.(\d)/g, '$1.$2')
    replace(/[^\}]+{(;)*}/g, '') // empty elements
    if (data.indexOf('charset') > 0) replace(/(.+)(@charset [^;]+;)/, '$2$1') // move first charset to the beginning
    replace(/(.)(@charset [^;]+;)/g, '$1') // remove all extra charsets that are not at the beginning
    replace(/\*([\.#:\[])/g, '$1') // remove universal selector when not needed (*#id, *.class etc)
    replace(/ {/g, '{') // whitespace before definition
    replace(/\} /g, '}') // whitespace after definition
    
    // Get the special comments && content back
    replace(/__CSSCOMMENT__/g, function() { return specialComments.shift(); });
    replace(/__CSSCONTENT__/g, function() { return contentBlocks.shift(); });
    
    return data.trim() // trim spaces at beginning and end
  }
};

// Given a path, canonicalise it by collapsing /.., /. and // parts
function canon ( path ) {
    // Collapse "blah/." to "blah/"
    path = path.replace( /([^\/]*\/)\/*\.(\/|$)/g, '$' );
    // Collapse "blah/.." to ""
    var dotdot = /[^\/]+\/\.\.(?:\/|$)/;
    while ( dotdot.test( path ) ) {
        path = path.replace( dotdot, '' );
    }
    // Collapse // to /
    path = path.replace( /\/+/g, '/' );

    return path;
}

// Given a path a/b, return the directory part a/
function dir ( path ) {
    path = path.replace( /[^\/]*$/, '' );
    return path;
}

// Given a source (file or dir) and a new file, return path to the new file. eg.
//  a    , c/d -> c/d
//  a/   , c/d -> a/c/d
//  a/b  , c/d -> a/c/d
//  a/b/ , c/d -> a/b/c/d
function pathOf ( src, file ) {
    return canon( dir( src ) + file );
}

// state is a bit nasty, everything has to be a sync call for
//  it to be passed down ok, but we're not a server or anything,
//  so that's ok
function processFiles ( files, processFn, callback ) {
    var results = [],
        remaining = files.length;
    
    files.forEach( function( src, i ) {
        fs.readFile( src, 'utf8', function ( error, data ) {
            if ( error ) {
                console.log( 'Could not read file ' + src );
            } else {
                processFn( src, data, function ( result ) {
                    results[i] = result;
                    if ( !( remaining -= 1 ) ) {
                        callback( results );
                    }
                });
            }
        });
    });
}

function inlineImportsAndImages( src, css, callback ) {
    var importRegExp = /@import\s*['"](.*)["']\s*;\n?/g,
        urlRegExp = /url\(\s*"?(.*?)"?\s*\)/g;
    
    css = css.replace( urlRegExp, function ( _, url ) {
        var importSrc = pathOf( src, url );
        var data = fs.readFileSync( importSrc );
        return 'url("data:image/' + url.slice( url.lastIndexOf( '.' ) + 1 ) +
            ';base64,' + data.toString( 'base64' ) + '")';
    });
    css = css.replace( importRegExp, function ( _, url ) {
        var importSrc = pathOf( src, url );
        return inlineImports(
            importSrc, fs.readFileSync( importSrc, 'utf8' ) );
    });

    callback && callback( css );
    return css;
}

var mapURLs = {};

// Returns the CSS with all @imports replaced by the actual file contents.
function inlineImports ( src, css, callback ) {
    var importRegExp = /@import\s*['"](.*)["']\s*;\n?/g;
    
    css = css.replace( importRegExp, function ( _, url ) {
        var importSrc = mapURLs[ url ] || pathOf( src, url );
        return inlineImports(
            importSrc, fs.readFileSync( importSrc, 'utf8' ) );
    });
    callback && callback( css );
    return css;
};

function findDependencies ( src, css, callback ) {
    var importRegExp = /@import\s*['"](.*)["']\s*;\n?/g;
    var dependencies = [ src ];
    var match, importSrc, lastIndex;
    importRegExp.lastIndex = 0;
    
    while ( match = importRegExp.exec( css ) ) {
        importSrc = pathOf( src, match[1] );
        lastIndex = importRegExp.lastIndex;
        dependencies = dependencies.concat( findDependencies(
            importSrc, fs.readFileSync( importSrc, 'utf8' ) ) );
        importRegExp.lastIndex = lastIndex;
    }
    
    callback && callback( dependencies );

    return dependencies;
};

function emround ( css ) {
    return css.replace(/([0-9]*\.[0-9]+)em/g, function ( val ) {
        var s = parseFloat( val ).toFixed( 3 );
        while ( s.slice( -1 ) === '0' ) {
            s = s.slice( 0, -1 );
        }
        if ( s.slice( -1 ) === '.' ) {
            s = s.slice( 0, -1 );
        }
        return s + 'em';
    });
};

exports.fromLess = function ( css, callback ) {
    css = css.replace( /(expression\([^;]+);/g, 'e("$1");' )
             .replace( /filter:\s*(alpha\([^;]+);/g, 'filter: e("$1");' );
    less.render( css, function ( error, css ) {
        if ( !error ) {
            css = emround( css );
            callback( css );
        } else {
            console.log( 'The LESS error is: ', error );
        }
    });
};

exports.minify = function ( css ) {
    return CleanCSS.process( css );
};

( function() {
    var commands = {
        less: function ( srcs, dest ) {
            processFiles( srcs, inlineImports, function ( results ) {
                var toProcess = results.length;
                results.forEach( function ( less, i ) {
                    exports.fromLess( less, function ( css ) {
                        results[i] = css;
                        toProcess -= 1;
                        if ( !toProcess ) {
                            fs.writeFile( dest, results.join( '\n\n' ) );
                        }
                    });
                })
            });
        },
        minify: function ( srcs, dest ) {
            processFiles( srcs, inlineImports, function ( results ) {
                exports.fromLess( results.join( '\n\n' ), function ( css ) {
                    fs.writeFile( dest, exports.minify( css ) );
                });
            });
        },
        dependencies: function ( srcs, dest ) {
            processFiles( srcs, findDependencies, function ( results ) {
                process.stdout.write( dest + ': ' +
                    results[0].join( " " ) + '\n\n');
            });
        },
        makeSingleFile: function ( srcs, dest ) {
            processFiles( srcs, inlineImports, function ( results ) {
                exports.fromLess( results.join('\n\n'), function ( css ) {
                    fs.writeFile( dest, css );
                });
            });
        },
        makeSingleIncImages: function ( srcs, dest ) {
            processFiles( srcs, inlineImportsAndImages, function ( results ) {
                exports.fromLess( results.join('\n\n'), function ( css ) {
                    fs.writeFile( dest, css );
                });
            });
        }
    };
    var command = process.argv[2];
    var srcs = process.argv.slice( 3 );
    var dest = srcs.pop();
    srcs = srcs.filter( function ( src ) {
        if ( src.indexOf( '=' ) > -1 ) {
            var parts = src.split( '=' );
            mapURLs[ parts[0] ] = parts[1];
            return false;
        }
        return true;
    });
    if ( commands[command] ) {
        commands[command]( srcs, dest );
    }
})();
