// -------------------------------------------------------------------------- \\
// File: WindowedRemoteQuery.js                                               \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Status.js, RemoteQuery.js                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS, undefined ) {

var Status = NS.Status,
    EMPTY = Status.EMPTY,
    READY = Status.READY,
    LOADING = Status.LOADING,
    OBSOLETE = Status.OBSOLETE;

/**
    Enum: O.WindowedRemoteQuery-WindowState
    
    The state of each window in the query is represented as follows:
    
    WINDOW_EMPTY             - Initial state. The window has not even been
                               requested.
    WINDOW_REQUESTED         - The ids in the window have been requested
    WINDOW_LOADING           - The ids in the window are being loaded by the
                               source.
    WINDOW_READY             - The ids in the window are all loaded and ready.
    WINDOW_RECORDS_REQUESTED - The records in the window have been requested.
    WINDOW_RECORDS_LOADING   - The records in the window are loading.
    WINDOW_RECORDS_READY     - The records in the window are ready.
*/
var WINDOW_EMPTY = 0,
    WINDOW_REQUESTED = 1,
    WINDOW_LOADING = 2,
    WINDOW_READY = 4,
    WINDOW_RECORDS_REQUESTED = 8,
    WINDOW_RECORDS_LOADING = 16,
    WINDOW_RECORDS_READY = 32;

var sortLinkedArrays = function ( a1, a2 ) {
    var zipped = a1.map( function ( item, i ) {
        return [ item, a2[i] ];
    });
    zipped.sort( function ( a, b ) {
        return a[0] - b[0];
    });
    zipped.forEach( function ( item, i ) {
        a1[i] = item[0];
        a2[i] = item[1];
    });
};

// We want to return the index in the array of the number, or one past the last
// position with a lower number if not present.
var binarySearch = function ( array, num ) {
    var lower = 0,
        upper = array.length,
        middle;
    while ( lower < upper ) {
        middle = ( lower + upper ) >> 1;
        if ( array[ middle ] < num ) {
            lower = middle + 1;
        } else {
            upper = middle;
        }
    }
    return lower;
};

var mergeSortedLinkedArrays = function ( a1, a2, b1, b2 ) {
    var rA = [],
        rB = [],
        i = 0,
        j = 0,
        l1 = a1.length,
        l2 = a2.length;

    // Take the smallest head element each time.
    while ( i < l1 || j < l2 ) {
        if ( j >= l2 || ( i < l1 && a1[i] < a2[j] ) ) {
            rA.push( a1[i] );
            rB.push( b1[i] );
            i += 1;
        } else {
            rA.push( a2[j] );
            rB.push( b2[j] );
            j += 1;
        }
    }
    return [ rA, rB ];
};

var adjustIndexes = function ( removed, added, removedBefore, ids, removedBeforeIds ) {
    var resultIndexes = [],
        resultIds = [],
        i, l, index, position, j, ll;
    for ( i = 0, l = removed.length; i < l; i += 1 ) {
        // Take the item removed in the second update
        index = removed[i];
        // And see how many items were added in the first update
        // before it
        position = binarySearch( added, index );
        // If there was an item added in the first update at the exact same
        // position, we don't need to do anything as they cancel each other out.
        // Since update 2 is from the state left by update 1, the ids MUST be
        // the same.
        if ( index === added[ position ] ) {
            continue;
        }
        // Otherwise, subtract the number of items added before it, as
        // these didn't exist in the original state.
        index -= position;
        // Now consider the indexes that were removed in the first
        // update. We need to increment the index for all indexes
        // before or equal to the index we're considering.
        for ( j = 0, ll = removedBefore.length;
                j < ll && index >= removedBefore[j]; j += 1 ) {
            index += 1;
        }
        // Now we have the correct index.
        resultIndexes.push( index );
        resultIds.push( ids[i] );
    }
    return mergeSortedLinkedArrays(
        removedBefore, resultIndexes, removedBeforeIds, resultIds );
};

var union = function ( a1, a2 ) {
    var result = [],
        i = 0, j = 0,
        l1 = a1.length, l2 = a2.length;
    while ( i < l1 && j < l2 ) {
        if ( a1[i] < a2[j] ) {
            result.push( a1[i] );
            i += 1;
        } else {
            if ( a1[i] === a2[j] ) {
                i += 1;
            }
            result.push( a2[j] );
            j += 1;
        }
    }
    while ( i < l1 ) {
        result.push( a1[i] );
        i += 1;
    }
    while ( j < l2 ) {
        result.push( a2[j] );
        j += 1;
    }
    return result;
};

var composeUpdates = function ( u1, u2 ) {
    var removed = adjustIndexes(
            u2.removedIndexes, u1.addedIndexes,  u1.removedIndexes,
            u2.removedIds, u1.removedIds ),
        added = adjustIndexes(
            u1.addedIndexes, u2.removedIndexes, u2.addedIndexes,
            u1.addedIds, u2.addedIds );

    return {
        removedIndexes: removed[0],
        removedIds: removed[1],
        addedIndexes: added[0],
        addedIds: added[1],
        changed: union( u1.changed, u2.changed ),
        truncateAtFirstGap:
            u1.truncateAtFirstGap || u2.truncateAtFirstGap,
        total: u2.total,
        upto: u2.upto
    };
};

// Where (a,b) and (c,d) are ranges.
// and a < b and c < d.
var intersect = function ( a, b, c, d ) {
    return a < c ? c < b : a < d;
};

// A window is determined to be still required if there is a range observer that
// intersects with any part of the window. The prefetch distance is added to the
// observer range.
var windowIsStillInUse = function ( index, windowSize, prefetch, ranges ) {
    var start = index * windowSize,
        margin = prefetch * windowSize,
        j = ranges.length;
    while ( j-- ) {
        if ( intersect( start, start + windowSize,
                ranges[j].start - margin,
                ranges[j].end + margin ) ) {
            break;
        }
    }
    return ( j !== -1 );
};

/**
    Class: O.WindowedRemoteQuery
    
    Extends: O.RemoteQuery
        
    A windowed remote query represents a potentially very large array of records
    calculated by the server. Records are loaded in blocks (windows); for
    example, with a window size of 30, accessing any record at indexes 0--29
    will cause all records within that range to be loaded, but does not
    necessarily load anything else.
    
    The class also supports an efficient modification sequence system for
    calculating, transfering and applying delta updates as the results of the
    query changes.
*/
var WindowedRemoteQuery = NS.Class({
    
    Extends: NS.RemoteQuery,
    
    className: 'WindowedRemoteQuery',
    
    /**
        Property: O.WindowedRemoteQuery#windowSize
        Type: Number
        
        The number of records that make up one window.
    */
    windowSize: 30,
    
    windowCount: function () {
        var length = this.get( 'length' );
        return ( length === null ) ? length :
            Math.floor( ( length - 1 ) / this.get( 'windowSize' ) ) + 1;
    }.property( 'length' ),
    
    /**
        Property: O.WindowedRemoteQuery#triggerPoint
        Type: Number
        
        If the record at an index less than this far from the end of a window is
        requested, the adjacent window will also be loaded (prefetching based on
        locality)
    */
    triggerPoint: 10,
    
    /**
        Property: O.WindowedRemoteQuery#optimiseFetching
        Type: Boolean
        
        If true, if a requested window is no longer either observed or adjacent
        to an observed window at the time <sourceWillFetchQuery> is called, the
        window is not actually requested.
    */
    optimiseFetching: false,
    
    /**
        Property: O.WindowedRemoteQuery#prefetch
        Type: Number
        
        The number of windows either side of an explicitly requested window, for
        which ids should be fetched.
    */
    prefetch: 1,
    
    /**
        Property (private): O.WindowedRemoteQuery#_isAnExplicitIdFetch
        Type: Boolean
        
        This is set to true when an explicit request is made to fetch ids (e.g.
        through <O.RemoteQuery#getIdsForObjectsInRange>). This prevents the
        query from optimising away the request when it corresponds to a
        non-observed range in the query.
    */
    
    init: function ( options ) {
        WindowedRemoteQuery.parent.init.call( this, options );
        this._windows = [];
        this._indexOfRequested = [];
        this._waitingPackets = [];
        this._preemptiveUpdates = [];
        
        this._isAnExplicitIdFetch = false;
        this._refreshRequested = false;
    },

    _fetchUpdates: true,
    refresh: function ( force, callback, doNotFetchUpdates ) {
        if ( doNotFetchUpdates ) {
            this._fetchUpdates = false;
        }
        return WindowedRemoteQuery.parent.refresh.call( this, force, callback );
    },
    
    reset: function ( _, _key ) {
        this._windows.length =
        this._indexOfRequested.length =
        this._waitingPackets.length =
        this._preemptiveUpdates.length = 0;
        
        this._isAnExplicitIdFetch = false;
        
        WindowedRemoteQuery.parent.reset.call( this, _, _key );
    }.observes( 'sort', 'filter' ),
    
    indexOf: function ( id, from, callback ) {
        var index = this._list.indexOf( id, from );
        if ( callback ) {
            // If we have a callback and haven't found it yet, we need to keep
            // searching.
            if ( index < 0 ) {
                // First check if the list is loaded
                var length = this.get( 'length' ),
                    windows = this._windows,
                    l = this.get( 'windowCount' );
                if ( l !== null ) {
                    while ( l-- ) {
                        if ( !( windows[l] & WINDOW_READY ) ) {
                            break;
                        }
                    }
                    // Everything loaded; the id simply isn't in it.
                    // index is -1.
                    if ( l < 0 ) {
                        callback( index );
                        return index;
                    }
                }
                // We're missing part of the list, so it may be in the missing
                // bit.
                this._indexOfRequested.push( [ id, function () {
                    callback( this._list.indexOf( id, from ) );
                }.bind( this ) ] );
                this.get( 'source' ).fetchQuery( this );
            } else {
                callback( index );
            }
        }
        return index;
    },
    
    getIdsForObjectsInRange: function ( start, end, callback ) {
        var length = this.get( 'length' ),
            complete = true;

        if ( length !== null ) {
            if ( start < 0 ) { start = 0 ; }
            if ( end > length ) { end = length; }
            
            var windowSize = this.get( 'windowSize' ),
                i = Math.floor( start / windowSize ),
                l = Math.floor( ( end - 1 ) / windowSize ) + 1;

            for ( ; i < l; i += 1 ) {
                if ( !( this._windows[i] & WINDOW_READY ) ) {
                    complete = false;
                    this._isAnExplicitIdFetch = true;
                    this.fetchWindow( i, false, 0 );
                }
            }
        } else {
            complete = false;
        }
        
        if ( complete ) {
            callback( this._list.slice( start, end ), start, end );
        }
        else {
            ( this._awaitingIdFetch || ( this._awaitingIdFetch = [] ) ).push(
                [ start, end, callback ] );
        }
        return !complete;
    },
    
    // Fetches all ids and records in window.
    // If within trigger distance of window edge, fetches adjacent window as
    // well.
    fetchDataForObjectAt: function ( index ) {
        // Load all headers in window containing index.
        var windowSize = this.get( 'windowSize' ),
            trigger = this.get( 'triggerPoint' ),
            windowIndex = Math.floor( index / windowSize ),
            withinWindowIndex = index % windowSize,
            id;
        
        this.fetchWindow( windowIndex, true );
        
        // If within trigger distance of end of window, load next window
        // Otherwise, just fetch Ids for next window.
        if ( withinWindowIndex < trigger ) {
            this.fetchWindow( windowIndex - 1, true );
        }
        if ( withinWindowIndex + trigger >= windowSize ) {
            this.fetchWindow( windowIndex + 1, true );
        }
    },
    
    /**
        Method: O.WindowedRemoteQuery#fetchWindow
        
        Fetches all records in the window with the index given. e.g. if the
        window size is 30, calling this with index 1 will load all records
        between positions 30 and 59 (everything 0-indexed).
        
        Parameters:
            index - {Number} The index of the window to load.
        
        Returns:
            {O.WindowedRemoteQuery} Returns self.
    */
    // Fetch ids in window either side as well.
    fetchWindow: function ( index, fetchRecords, prefetch ) {
        var status = this.get( 'status' ),
            windows = this._windows,
            doFetch = false,
            i, l;
        if ( status & OBSOLETE ) {
            this.refresh();
        }
        
        if ( prefetch === undefined ) {
            prefetch = this.get( 'prefetch' );
        }
        
        i = Math.max( 0, index - prefetch );
        l = Math.min( index + prefetch + 1, this.get( 'windowCount' ) || 0 );
        
        for ( ; i < l; i += 1 ) {
            status = windows[i] || 0;
            if ( status === WINDOW_EMPTY ) {
                status = WINDOW_REQUESTED;
                doFetch = true;
            }
            if ( i === index && fetchRecords &&
                    status < WINDOW_RECORDS_REQUESTED ) {
                if ( ( status & WINDOW_READY ) &&
                        this.checkIfWindowIsFetched( i ) ) {
                    status = (WINDOW_READY|WINDOW_RECORDS_READY);
                } else {
                    status = status | WINDOW_RECORDS_REQUESTED;
                }
                doFetch = true;
            }
            windows[i] = status;
        }
        if ( doFetch ) {
            this.get( 'source' ).fetchQuery( this );
        }
        return this;
    },
    
    // When Ids known:
    checkIfWindowIsFetched: function ( index ) {
        var store = this.get( 'store' ),
            list = this._list,
            Type = this.get( 'type' ),
            windowSize = this.get( 'windowSize' ),
            i = index * windowSize,
            l = Math.min( i + windowSize, this.get( 'length' ) );
        for ( ; i < l; i += 1 ) {
            if ( store.getRecordStatus( Type, list[i] ) & (EMPTY|OBSOLETE) ) {
                return false;
            }
            return true;
        }
    },
    
    /**
        Method: O.WindowedRemoteQuery#recalculateFetchedWindows
        
        Recalculates whether the ids and records are fetched for windows,
        for all windows with an index equal or greater than that of the window
        containing the start index given.
        
        Although the information on whether the records for a window are loaded
        is reset, it is not recalculated; this will be done on demand when a
        fetch is made for the window.
        
        Parameters:
            start - {Number} The index of the first record to have changed (i.e.
                    invalidate all window information starting from the window
                    containing this index).
            length - {Number} The new length of the list.
    */
    recalculateFetchedWindows: function ( start, length ) {
        if ( !start ) { start = 0; }
        if ( length === undefined ) { length = this.get( 'length' ); }
        
        var windowSize = this.get( 'windowSize' ),
            windows = this._windows,
            list = this._list,
            // Start at last window index
            windowIndex = Math.floor( ( length - 1 ) / windowSize ),
            // And last list index
            listIndex = length - 1,
            target, status;
        
        // Convert start from list index to window index.
        start = Math.floor( start / windowSize );
        
        // Truncate any non-existant windows.
        windows.length = windowIndex + 1;
        
        // Unless there's something defined for all properties between
        // listIndex and windowIndex we must remove the WINDOW_READY flag.
        // We always remove WINDOWS_RECORDS_READY flag, and calculate this when
        // the window is requested.
        while ( windowIndex >= start ) {
            target = windowIndex * windowSize;
            status = ( windows[ windowIndex ] || 0 ) & ~WINDOW_RECORDS_READY;
            windows[ windowIndex ] = status;
            while ( listIndex >= target ) {
                if ( !list[ listIndex ] ) {
                    windows[ windowIndex ] = status & ~WINDOW_READY;
                    break;
                }
                listIndex -= 1;
            }
            listIndex = target - 1;
            windowIndex -= 1;
        }
        return this;
    },
    
    // ---- Updates:
    
    _normaliseUpdate: function ( update ) {
        var list = this._list,
            removedIds = update.removed || [],
            removedIndexes = removedIds.map( function ( id ) {
                return list.indexOf( id );
            }),
            addedIds = [],
            addedIndexes = [],
            added = update.added || [],
            i, l, item;
        
        for ( i = 0, l = added.length; i < l; i += 1 ) {
            item = added[i];
            addedIndexes.push( item[0] );
            addedIds.push( item[1] );
        }
        update.addedIndexes = addedIndexes;
        update.addedIds = addedIds;
        
        sortLinkedArrays( removedIndexes, removedIds );
        for ( i = 0; removedIndexes[i] === -1; i += 1 ) {
            // Do nothing (we just want to find the first index of known
            // position).
        }
        // If we have some ids we don't know the index of.
        if ( i ) {
            // Ignore them.
            removedIndexes = removedIndexes.slice( i );
            removedIds = removedIds.slice( i );
        }
        // But truncate at first gap.
        update.truncateAtFirstGap = !!i;
        update.removedIndexes = removedIndexes;
        update.removedIds = removedIds;
        
        if ( update.changed ) {
            update.changed.sort();
        } else {
            update.changed = [];
        }
        
        if ( !update.total ) {
            update.total = this.get( 'length' ) -
                removedIndexes.length + addedIndexes.length;
        }
        
        return update;
    },
    
    _applyUpdate: function ( args, preemptive ) {
        var removedIndexes = args.removedIndexes,
            removedIds = args.removedIds,
            removedLength = removedIds.length,
            addedIndexes = args.addedIndexes,
            addedIds = args.addedIds,
            addedLength = addedIds.length,
            changed = args.changed,
            list = this._list,
            recalculateFetchedWindows = !!( addedLength || removedLength ),
            oldLength = this.get( 'length' ),
            newLength = args.total,
            firstChange = oldLength,
            i, l, index, id, listLength;
        
        // --- Remove items from list ---
        
        l = removedLength;
        while ( l-- ) {
            index = removedIndexes[l];
            list.splice( index, 1 );
            if ( index < firstChange ) { firstChange = index; }
        }
        
        if ( args.truncateAtFirstGap ) {
            // Truncate the list so it does not contain any gaps; anything after
            // the first gap may be incorrect as a record may have been removed
            // from that gap.
            i = 0;
            while ( list[i] ) { i += 1; }
            list.length = i;
            if ( i < firstChange ) { firstChange = i; }
        }
        
        // --- Add items to list ---
        
        // If the index is past the end of the array, you can't use splice
        // (unless you set the length of the array first), so use standard
        // assignment.
        listLength = list.length;
        for ( i = 0, l = addedLength; i < l; i += 1 ) {
            index = addedIndexes[i];
            id = addedIds[i];
            if ( index >= listLength ) {
                list[ index ] = id;
                listLength = index + 1;
            } else {
                list.splice( index, 0, id );
                listLength += 1;
            }
            if ( index < firstChange ) { firstChange = index; }
        }
        
        // --- Check upto ---
        
        // upto is the last item id the updates are to. Anything after here
        // may have changed, but won't be in the updates, so we need to truncate
        // the list to ensure it doesn't get into an inconsistent state.
        // If we can't find the id, we have to reset.
        if ( args.upto ) {
            l = list.lastIndexOf( args.upto ) + 1;
            if ( l ) {
                if ( l !== listLength ) {
                    recalculateFetchedWindows = true;
                    list.length = l;
                }
            } else {
                return this.reset();
            }
        }
        
        // --- Recalculate fetched windows ---
        
        // --- Process updates ---
        
        // Do we have item changes (ignored for preemptive)?
        if ( !preemptive && changed.length ) {
            // Observers should be observing the state of all the records
            // in the range they're currently interested in; this will let them
            // know if there's an update and allow them to fetch it immediately.
            // Otherwise, we'll fetch the updates the next time that window is
            // accessed.
            
            // Recheck each window for updates when fetching.
            this.recalculateFetchedWindows( 0, newLength );
            
            // Mark records that need an update.
            this.get( 'store' ).sourceHasUpdatesForRecords(
this.get( 'type' ), changed );
        }
        // Anything from the firstChange index onwards may have changed, so we
        // have to recalculate which windows that cover indexes from this point
        // onwards we now have ids for. We only bother to recalculate whether we
        // have a complete set of ids; if the window needs an update or does
        // not have all records in memory, this will be recalculated when it is
        // accessed.
        else if ( recalculateFetchedWindows ) {
            this.recalculateFetchedWindows( firstChange, newLength );
        }
        
        // --- Broadcast changes ---
        
        this.set( 'status', this.get( 'status' ) & ~( OBSOLETE|LOADING ) )
            .set( 'length', newLength )
            .rangeDidChange( firstChange, Math.max( oldLength, newLength ) );
        
        // For selection purposes, list view will need to know the ids of those
        // which were removed. Also, keyboard indicator will need to know the
        // indexes of those removed or added.
        this.fire( 'query:updated', {
            removed: removedIds,
            removedIndexes: removedIndexes,
            added: addedIds,
            addedIndexes: addedIndexes
        });
        
        // --- And process any waiting data packets ---
        
        this._applyWaitingPackets();
        
        return this;
    },
    
    _applyWaitingPackets: function () {
        var didDropPackets = false,
            waitingPackets = this._waitingPackets,
            l = waitingPackets.length,
            state = this.get( 'state' ),
            packet;
        
        while ( l-- ) {
            packet = waitingPackets.shift();
            // If these values aren't now the same, the packet must
            // be OLDER than our current state, so just discard.
            if ( packet.state !== state ) {
                // But also fetch everything missing in observed range, to
                // ensure we have the required data
                didDropPackets = true;
            } else {
                this.sourceDidFetchIdList( packet );
            }
        }
        if ( didDropPackets ) {
            this._fetchObservedWindows();
        }
    },
    
    _fetchObservedWindows: function () {
        var ranges = NS.meta( this ).rangeObservers,
            length = this.get( 'length' ),
            windowSize = this.get( 'windowSize' ),
            observerStart, observerEnd,
            firstWindow, lastWindow,
            range, l;
        if ( ranges ) {
            l = ranges.length;
            while ( l-- ) {
                range = ranges[l].range;
                observerStart = range.start || 0;
                observerEnd = 'end' in range ? range.end : length;
                if ( observerStart < 0 ) { observerStart += length; }
                if ( observerEnd < 0 ) { observerEnd += length; }
                firstWindow = Math.floor( observerStart / windowSize );
                lastWindow = Math.floor( ( observerEnd - 1 ) / windowSize );
                for ( ; firstWindow <= lastWindow; firstWindow += 1 ) {
                    this.fetchWindow( firstWindow, true );
                }
            }
        }
    },
    
    /**
        Method: O.WindowedRemoteQuery#clientDidGenerateUpdate
        
        Call this to update the list with what you think the server will do
        after an action has committed. The change will be applied immediately,
        making the UI more responsive, and be checked against what actually
        happened next time an update arrives. If it turns out to be wrong the
        list will be reset, but in most cases it should appear more efficient.
        
        removed - {Array.<String>} (optional) The ids of all records to delete.
        added   - {Array.<Array>} (optional) A list of [ index, id ] pairs, in
                  ascending order of index, for all records to be inserted.
        changed - {Array.<String>} (optional) The ids of records the client has
                  updated; these are then removed from the changed list the next
                  time, and any extras are added (as they have been erroneously
                  updated and so now must be updated by the server).
        
        Parameters:
            update - {Object} The removed/added/changed updates to make.
        
        Returns:
            {O.WindowedRemoteQuery} Returns self.
    */
    clientDidGenerateUpdate: function ( update ) {
        this._normaliseUpdate( update );
        this._applyUpdate( update, true );
        this._preemptiveUpdates.push( update );
        return this;
    },
    
    /**
        Method: O.WindowedRemoteQuery#sourceDidFetchUpdate
        
        The source should call this when it fetches a delta update for the
        query. The args object should contain the following properties:
        
        newState - {String} The state this delta updates the remote query to.
        oldState - {String} The state this delta updates the remote query from.
        sort     - {String} The sort presumed in this delta.
        filter   - {String} The filter presumed in this delta.
        removed  - {Array.<String>} The ids of all records removed since
                   oldState.
        added   - {Array.<Array>} A list of [ index, id ] pairs, in ascending
                   order of index, for all records added since oldState.
        changed - {Array.<String>} The ids of all records in this query which
                  are out-of-date (have updated information available on the
                  server).
        upto    - {String} (optional) As an optimisation, updates may only be
                  for the first portion of a list, upto a certain id. This is
                  the last id which is included in the range covered by the
                  updates; any information past this id must be discarded, and
                  if the id can't be found the list must be reset.
        total   - {Number} (optional) The total number of records in the list.
        
        Parameters:
            update - {Object} The delta update (see description above).
        
        Returns:
            {O.Source} Returns self.
    */
    sourceDidFetchUpdate: function () {
        var equalArrays = function ( a1, a2 ) {
            var l = a1.length;
            if ( a2.length !== l ) { return false; }
            while ( l-- ) {
                if ( a1[l] !== a2[l] ) { return false; }
            }
            return true;
        };
        
        var updateIsEqual = function ( u1, u2 ) {
            return u1.total === u2.total &&
                equalArrays( u1.addedIndexes, u2.addedIndexes ) &&
                equalArrays( u1.addedIds, u2.addedIds ) &&
                equalArrays( u1.removedIndexes, u2.removedIndexes ) &&
                equalArrays( u1.removedIds, u2.removedIds );
        };
        
        var findUncommon = function ( a1, a2 ) {
            var result = [],
                i = 0, j = 0,
                l1 = a1.length, l2 = a2.length;
            while ( i < l1 && j < l2 ) {
                if ( a1[i] < a2[j] ) {
                    result.push( a1[i] );
                    i += 1;
                } else if ( a1[i] > a2[j] ) {
                    result.push( a2[j] );
                    j += 1;
                } else {
                    i += 1;
                    j += 1;
                }
            }
            while ( i < l1 ) {
                result.push( a1[i] );
                i += 1;
            }
            while ( j < l2 ) {
                result.push( a2[j] );
                j += 1;
            }
            return result;
        };
        
        return function ( update ) {
            var state = this.get( 'state' );
            // Check we've not already got this update.
            if ( state === update.newState ) {
                this.set( 'status', READY );
                return;
            }
            // We can only update from our old state.
            if ( state !== update.oldState ) {
                this.setObsolete();
                return;
            }
            if ( update.sort !== this.get( 'sort' ) ||
                    update.filter !== this.get( 'filter' ) ) {
                return;
            }
            this.set( 'state', update.newState );
        
            var preemptives = this._preemptiveUpdates,
                l = preemptives.length;
        
            if ( !l ) {
                this._applyUpdate( this._normaliseUpdate( update ) );
            } else {
                // 1. Compose all preemptives:
                // [p1, p2, p3] -> [p1, p1 + p2, p1 + p2 + p3 ]
                var composed = [ preemptives[0] ],
                    i;
                for ( i = 1; i < l; i += 1 ) {
                    composed[i] = composeUpdates(
                        composed[ i - 1 ], preemptives[i] );
                }
            
                // 2. Normalise the update from the server. This is trickier
                // than normal, as we need to determine what the indexes of the
                // removed ids were in the previous state.
                var normalisedUpdate = this._normaliseUpdate({
                    added: update.added,
                    changed: update.changed,
                    total: update.total,
                    upto: update.upto
                });

                // Find the removedIndexes for our update. If they were removed
                // in the composed preemptive, we have the index. Otherwise, we
                // need to search for the id in the current list then compose
                // the result with the preemptive in order to get the original
                // index.
                var allPreemptives = composed[ l - 1 ],
                    removed = update.removed,
                    _indexes = [],
                    _ids = [],
                    removedIndexes = [],
                    removedIds = [],
                    list = this._list,
                    id, index, changed;
                
                for ( i = 0, l = removed.length; i < l; i += 1 ) {
                    id = removed[i];
                    index = allPreemptives.removedIds.indexOf( id );
                    if ( index > -1 ) {
                        removedIndexes.push(
                            allPreemptives.removedIndexes[ index ] );
                        removedIds.push( id );
                    } else {
                        index = list.indexOf( id );
                        if ( index > -1 ) {
                            _indexes.push( index );
                            _ids.push( id );
                        } else {
                            normalisedUpdate.truncateAtFirstGap = true;
                        }
                    }
                }
                if ( l = _indexes.length ) {
                    var x = composeUpdates( allPreemptives, {
                        removedIndexes: _indexes,
                        removedIds: _ids,
                        addedIndexes: [],
                        addedIds: [],
                        changed: []
                    });
                    _indexes = _ids.map( function ( id ) {
                        return x.removedIndexes[ x.removedIds.indexOf( id ) ];
                    });
                    removedIndexes.push.apply( removedIndexes, _indexes );
                    removedIds.push.apply( removedIds, _ids );
                }
                
                sortLinkedArrays( removedIndexes, removedIds );
            
                normalisedUpdate.removedIndexes = removedIndexes;
                normalisedUpdate.removedIds = removedIds;
            
                // 3. We now have a normalised update from the server. We
                // compare this to each composed state of our preemptive
                // updates. If it matches any completely, we guessed correctly
                // and the list is already up to date. We just need to set the
                // status and apply any waiting packets. If it doesn't match, we
                // remove all our preemptive updates and apply the update from
                // the server instead, to ensure we end up in a consistent
                // state.
                if ( !normalisedUpdate.truncateAtFirstGap ) {
                    l = composed.length;
                    while ( l-- ) {
                        if ( updateIsEqual( normalisedUpdate, composed[l] ) ) {
                            break;
                        }
                    }
                }
                if ( !normalisedUpdate.truncateAtFirstGap && l > -1 ) {
                    // OK, we correctly guessed, so actually everything's up to
                    // date. But there could be several matching updates if only
                    // the changed field is used. If we can find one where the
                    // changed field matches too, that would be better.
                    for ( i = l; i >= 0; i -= 1 ) {
                        if ( equalArrays( normalisedUpdate.changed,
                                composed[i].changed ) ) {
                            break;
                        }
                    }
                    if ( i > -1 && i !== l &&
                        updateIsEqual( normalisedUpdate, composed[i] ) ) {
                            l = i;
                    }
                    
                    preemptives.splice( 0, l + 1 );
                    changed = findUncommon(
                        composed[l].changed, normalisedUpdate.changed );
                    if ( changed.length ) {
                        this.recalculateFetchedWindows();
                        this.get( 'store' )
                            .sourceHasUpdatesForRecords(
                                this.get( 'type' ), changed );
                    }
                    this.set( 'status',
                        this.get( 'status' ) & ~( OBSOLETE|LOADING ) );
                    this._applyWaitingPackets();
                } else {
                    preemptives.length = 0;
                    this._applyUpdate( composeUpdates({
                        removedIndexes: allPreemptives.addedIndexes,
                        removedIds: allPreemptives.addedIds,
                        addedIndexes: allPreemptives.removedIndexes,
                        addedIds: allPreemptives.removedIds,
                        changed: allPreemptives.changed
                    }, normalisedUpdate ) );
                }
            }
        };
    }(),
    
    /**
        Method: O.WindowedRemoteQuery#sourceDidFetchIdList
        
        The source should call this when it fetches a portion of the id list for
        this query. The args object should contain:
        
        state    - {String} The state of the server when this slice was taken.
        sort     - {String} The sort used.
        filter   - {String} The filter used.
        idList   - {Array.<String>} The list of ids.
        position - {Number} The index in the query of the first id in idList.
        total    - {Number} The total number of records in the query.
        
        Parameters:
            args - {Object} The portion of the overall id list. See above for
                   details.
        
        Returns:
            {O.WindowedRemoteQuery} Returns self.
    */
    sourceDidFetchIdList: function ( args ) {
        // User may have changed sort or filter in intervening time; presume the
        // value on the object is the right one, so if data doesn't match, just
        // ignore it.
        if ( this.get( 'sort' ) !== args.sort ||
                this.get( 'filter' ) !== args.filter ) {
            return;
        }
        
        // If the state does not match, the list has changed since we last
        // queried it, so we must get the intervening updates first.
        var state = this.get( 'state' );
        if ( state ) {
            if ( state !== args.state ) {
                this._waitingPackets.push( args );
                return this.setObsolete().refresh();
            }
        } else {
            this.set( 'state', args.state );
        }

        var ids = args.idList,
            length = ids.length,
            position = args.position,
            total = args.total,
            list = this._list,
            end;
        
        // Need to adjust for preemptive updates
        var preemptives = this._preemptiveUpdates,
            l = preemptives.length;
        if ( l ) {
            // Adjust ids, position, length
            var allPreemptives = preemptives.reduce( composeUpdates ),
                addedIndexes = allPreemptives.addedIndexes,
                addedIds = allPreemptives.addedIds,
                removedIndexes = allPreemptives.removedIndexes,
                i, index;
            
            l = removedIndexes.length;
            while ( l-- ) {
                index = removedIndexes[l] - position;
                if ( index < length ) {
                    if ( index >= 0 ) {
                        ids.splice( index, 1 );
                        length -= 1;
                    } else {
                        position -= 1;
                    }
                }
            }
            for ( i = 0, l = addedIndexes.length; i < l; i += 1 ) {
                index = addedIndexes[i] - position;
                if ( index <= 0 ) {
                    position += 1;
                } else if ( index < length ) {
                    ids.splice( index, 0, addedIds[i] );
                    length += 1;
                } else {
                    break;
                }
            }
            total = allPreemptives.total;
        }
        
        // Calculate end index, as length will be destroyed later
        end = position + length;
        
        // Set the length to the beginning of the splice to ensure it will work.
        // Otherwise the splice will add the elements in at the position of the
        // current end of the array!
        if ( list.length < position ) {
            list.length = position;
        }
        
        ids.unshift( position, length );
        Array.prototype.splice.apply( list, ids );
        
        // Have we fetched any windows?
        var windowSize = this.get( 'windowSize' ),
            windowIndex = Math.floor( position / windowSize ),
            withinWindowIndex = position % windowSize;
        // If the results start part way through a window, the first possible
        // complete one is the next one, so increment the index and update the
        // count of remaining records
        if ( withinWindowIndex ) {
            windowIndex += 1;
            length -= ( windowSize - withinWindowIndex );
        }
        // Now, for each set of windowSize records, we have a complete window.
        while ( ( length -= windowSize ) >= 0 ) {
            this._windows[ windowIndex ] |= WINDOW_READY;
            windowIndex += 1;
        }
        // Need to check if the final window was loaded (may not be full-sized).
        length += windowSize;
        if ( length && end === total && length === ( total % windowSize ) ) {
            this._windows[ windowIndex ] |= WINDOW_READY;
        }
        
        // All that's left is to inform observers of the changes.
        return this.set( 'status', READY )
                   .set( 'length', total )
                   .rangeDidChange( position, end )
                   .fire( 'query:idsLoaded' );
    },
    
    sourceWillFetchQuery: function () {
        // If optimise and no longer observed -> remove request
        // Move from requested -> loading
        var windowSize = this.get( 'windowSize' ),
            windows = this._windows,
            isAnExplicitIdFetch = this._isAnExplicitIdFetch,
            indexOfRequested = this._indexOfRequested,
            refreshRequested = this._refresh,
            fetchUpdates = this._fetchUpdates,
            recordRequests = [],
            idRequests = [],
            optimiseFetching = this.get( 'optimiseFetching' ),
            ranges = optimiseFetching ?
                ( O.meta( this, true ).rangeObservers || [] ).map(
                    function ( observer ) {
                return observer.range;
            }) : null,
            prefetch = this.get( 'prefetch' ),
            i, l, status, inUse, rPrev, iPrev, start;
        
        this._isAnExplicitIdFetch = false;
        this._indexOfRequested = [];
        this._refresh = false;
        this._fetchUpdates = true;
        
        for ( i = 0, l = windows.length; i < l; i += 1 ) {
            status = windows[i];
            if ( status & (WINDOW_REQUESTED|WINDOW_RECORDS_REQUESTED) ) {
                inUse = !optimiseFetching ||
                    windowIsStillInUse( i, windowSize, prefetch, ranges );
                if ( status & WINDOW_RECORDS_REQUESTED ) {
                    status &= ~(WINDOW_RECORDS_REQUESTED);
                    if ( inUse ) {
                        start = i * windowSize;
                        if ( rPrev &&
                                rPrev.start + rPrev.count === start ) {
                            rPrev.count += windowSize;
                        } else {
                            recordRequests.push( rPrev = {
                                start: start,
                                count: windowSize
                            });
                        }
                        status |= WINDOW_LOADING;
                        status |= WINDOW_RECORDS_LOADING;
                    }
                    // If not requesting records and an explicit id fetch, leave
                    // WINDOW_REQUESTED flag set the ids are still requested.
                    if ( inUse || !isAnExplicitIdFetch ) {
                        status &= ~WINDOW_REQUESTED;
                    } else {
                        status |= WINDOW_REQUESTED;
                    }
                }
                if ( status & WINDOW_REQUESTED ) {
                    if ( inUse || isAnExplicitIdFetch ) {
                        start = i * windowSize;
                        if ( iPrev && iPrev.start + iPrev.count === start ) {
                            iPrev.count += windowSize;
                        } else {
                            idRequests.push( iPrev = {
                                start: start,
                                count: windowSize
                            });
                        }
                        status |= WINDOW_LOADING;
                    }
                    status &= ~WINDOW_REQUESTED;
                }
            }
            windows[i] = status;
        }
        
        if ( refreshRequested ) {
            this.setLoading();
        }
        
        return {
            ids: idRequests,
            records: recordRequests,
            indexOf: indexOfRequested,
            refresh: refreshRequested,
            fetchUpdates: fetchUpdates,
            callback: function () {
                this._windows = this._windows.map( function ( status ) {
                    return status & ~(WINDOW_LOADING|WINDOW_RECORDS_LOADING);
                });
            }.bind( this )
        };
    }
});

NS.WindowedRemoteQuery = WindowedRemoteQuery;

}( O ) );