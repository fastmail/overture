// -------------------------------------------------------------------------- \\
// File: Draggable.js                                                         \\
// Module: View                                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

NS.Draggable = {
    isDraggable: true,
    isDragging: false,
    dragStarted: function ( drag ) {},
    dragMoved: function ( drag ) {},
    dragEnded: function ( drag ) {}
};

}( O ) );