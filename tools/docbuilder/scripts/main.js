/*global window, document */

"use strict";

( function ( undefined ) {
    var contains = function ( that, string, separator ) {
        return ( separator ?
            ( separator + that + separator ).indexOf(
                separator + string + separator ) :
            that.indexOf( string ) ) > -1;
    };
    
    var hasClass = function ( el, klass ) {
        return contains( el.className, klass, ' ' );
    };

    var addClass = function ( el, klass ) {
        var current = el.className;
        if ( !contains( current, klass, ' ' ) ) {
            el.className = ( current ? current + ' ' : '' ) + klass;
        }
        return el;
    };

    var removeClass = function ( el, klass ) {
        var current = el.className,
            index = (' ' + current + ' ').indexOf( ' ' + klass + ' ');
        if ( index > -1 ) {
            el.className = current.slice( 0, index && index - 1 ) +
                           current.slice( index + klass.length );
        }
        return el;
    };
        
    var setPreference = function ( name, value ) {
        var ls = window.localStorage;
        if ( ls ) {
            ls.setItem( name, JSON.stringify( value ) );
        }
    };
    
    var getPreference = function ( name, theDefault ) {
        var ls = window.localStorage;
        if ( ls ) {
            var  result = ls.getItem( name );
            if ( result != null ) {
                return JSON.parse( result );
            } else {
                setPreference( name, theDefault );
            }
        }
        return theDefault;
    };
    
    var setClassForPref = function ( name, theDefault ) {
        if ( getPreference( name, theDefault ) ) {
            addClass( document.documentElement, name );
        } else {
            removeClass( document.documentElement, name );
        }
    };
    
    setClassForPref( 'hidePrivate', false );
    setClassForPref( 'hideProtected', false );
    setClassForPref( 'hideCode', false );
    
    var bindPrefToCheckbox = function ( name ) {
        // Invert for 'Show' rather than 'hide'.
        var value = !getPreference( name );
        var box = document.getElementById( name );
        box.checked = value;
        box.addEventListener( 'click', function () {
            setPreference( name, !box.checked );
            setClassForPref( name );
        }, false );
    };
    
    window.addEventListener( 'load', function () {
        bindPrefToCheckbox( 'hidePrivate' );
        bindPrefToCheckbox( 'hideProtected' );
        bindPrefToCheckbox( 'hideCode' );
    }, false );
    
}() );