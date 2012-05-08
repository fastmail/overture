// -------------------------------------------------------------------------- \\
// File: AggregateSource.js                                                   \\
// Module: DataStore                                                          \\
// Requires: Source.js                                                        \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

/**
    Class: O.AggregateSource
    
    An O.AggregateSource instance can be used to collect several <O.Source>
    instances together to present to an instance of <O.Store>. Each method call
    on an aggregate source is passed around the sources it is managing until it
    finds one that can handle it.
*/
var AggregateSource = NS.Class({
    
    Extends: NS.Source,
    
    init: function ( options ) {
        this.sources = [];
        AggregateSource.parent.init.call( this, options );
    },
    
    /**
        Property: O.AggregateSource#sources
        Type: Array.<O.Source>
        
        List of sources to pass requests to. Will be tried in order.
    */
    
    /**
        Method: O.AggregateSource#addSource
        
        Parameters:
            source - {O.Source} The source to add to the end of the list of
                     aggregated sources.
        
        Returns:
            {O.AggregateSource} Returns self.
    */
    addSource: function ( source ) {
        this.sources.push( source );
        return this;
    },
    
    /**
        Method: O.AggregateSource#removeSource
        
        Parameters:
            source - {O.Source} The source to remove from the list of aggregated
                     sources.
        
        Returns:
            {O.AggregateSource} Returns self.
    */
    removeSource: function ( source ) {
        this.sources.erase( source );
        return this;
    },
    
    send: function () {
        this.sources.forEach( function ( source ) {
            source.send();
        });
    },
    
    fetchRecords: function ( Type, ids, callback ) {
        return this.sources.some( function ( source ) {
            return source.fetchRecords( Type, ids, callback );
        });
    },
    
    refreshRecords: function ( Type, ids, callback ) {
        return this.sources.some( function ( source ) {
            return source.refreshRecords( Type, ids, callback );
        });
    },
    
    commitChanges: function ( changes ) {
        this.sources.forEach( function ( source ) {
            source.commitChanges( changes );
        });
        return this;
    },
    
    fetchQuery: function ( query, callback ) {
        return this.sources.some( function ( source ) {
            return source.fetchQuery( query, callback );
        });
    }
});

NS.AggregateSource = AggregateSource;

}( O ) );