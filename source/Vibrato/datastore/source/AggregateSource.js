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
        this.get( 'sources' ).push( source );
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
        this.get( 'sources' ).erase( source );
        return this;
    },
    
    fetchRecord: function ( Type, id, callback ) {
        return this.get( 'sources' ).some( function ( source ) {
            return source.fetchRecord( Type, id, callback );
        });
    },
    
    fetchAllRecords: function ( Type, callback ) {
        return this.get( 'sources' ).some( function ( source ) {
            return source.fetchAllRecords( Type, callback );
        });
    },
    
    refreshRecord: function ( Type, id, callback ) {
        return this.get( 'sources' ).some( function ( source ) {
            return source.refreshRecord( Type, id, callback );
        });
    },
    
    commitChanges: function ( changes ) {
        this.get( 'sources' ).forEach( function ( source ) {
            source.commitChanges( changes );
        });
        return this;
    },
    
    fetchQuery: function ( query, callback ) {
        return this.get( 'sources' ).some( function ( source ) {
            return source.fetchQuery( query, callback );
        });
    }
});

NS.AggregateSource = AggregateSource;

}( O ) );