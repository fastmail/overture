// -------------------------------------------------------------------------- \\
// File: DragDataSource.js                                                    \\
// Module: View                                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

NS.DragDataSource = {
    init: function ( dragData ) {
        if ( !dragData ) { dragData = {}; }
        this._dragData = dragData;
        this.dragDataTypes = Object.keys( dragData );
        this.get = function ( key ) {
            return this[ key ];
        };
    },
    isDragDataSource: true,
    dragDataTypes: [],
    getDragDataOfType: function ( type, drag ) {
        return this._dragData[ type ];
    }
};

}( O ) );