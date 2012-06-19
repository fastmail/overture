// -------------------------------------------------------------------------- \\
// File: DropTarget.js                                                        \\
// Module: View                                                               \\
// Requires: Drag.js                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

NS.DropTarget = {
    isDropTarget: true,
    hasDragOver: false,
    dropEffect: NS.Drag.MOVE,
    dropAcceptedDataTypes: {},
    willAcceptDrag: function ( drag ) {
        var acceptedTypes = this.get( 'dropAcceptedDataTypes' ),
            availableTypes = drag.get( 'dataTypes' ),
            l = availableTypes.length;
        while ( l-- ) {
            if ( acceptedTypes[ availableTypes[l] ] ) {
                return true;
            }
        }
        return false;
    },
    // Called when it becomes drop target
    dropEntered: function ( drag ) {
        drag.set( 'dropEffect', this.get( 'dropEffect' ) );
        this.set( 'hasDragOver', true );
    },
    // Called periodically when over element
    dropMoved: function ( drag ) {},
    // Called (if dropEntered was called) when no longer drop target.
    // Guaranteed to be called if dropEntered is called.
    dropExited: function ( drag ) {
        drag.set( 'dropEffect', NS.Drag.MOVE );
        this.set( 'hasDragOver', false );
    },
    // Called on drop if target accepted
    drop: function ( drag ) {}
};

}( this.O ) );