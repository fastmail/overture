// -------------------------------------------------------------------------- \\
// File: DropTarget.js                                                        \\
// Module: View                                                               \\
// Requires: DragEffect.js                                                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Mixin: O.DropTarget

    The DropTarget mixin should be applied to views you wish to make drop
    targets.
*/
NS.DropTarget = {
    /**
        Property: O.DropTarget#isDropTarget
        Type: Boolean
        Default: true

        Identifies the view as a drop target.
    */
    isDropTarget: true,

    /**
        Property: O.DropTarget#hasDragOver
        Type: Boolean

        True if the view is a drag is currently over the view.
    */
    hasDragOver: false,

    /**
        Property: O.DropTarget#dropEffect
        Type: O.DragEffect
        Default: O.DragEffect.MOVE

        The effect that will be applied to the data if dropped.
    */
    dropEffect: NS.DragEffect.MOVE,

    /**
        Property: O.DropTarget#dropAcceptedDataTypes
        Type: Object

        An object mapping data types the drop target can handle to a truthy
        value.
    */
    dropAcceptedDataTypes: {},

    /**
        Method: O.DropTarget#willAcceptDrag

        When a drag moves over the drop target, this method will be called to
        determine whether the target is willing to accept the drag. If it
        returns true, it will become the active drop target. If it returns
        false, it will be ignored, and any parent views which are drop targets
        will be considered instead.

        Unless overridden, this method simply checks whether any of the data
        types available in the drag are included in its dropAcceptedDataTypes
        property.

        Parameters:
            drag - {O.Drag} The drag instance.

        Returns:
            {Boolean} Can the drag be dropped here?
    */
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

    /**
        Method: O.DropTarget#dropEntered

        Called when a drag instance enters the view. If this method is called,
        the dropExited method is guaranteed to be called later.

        Sets the drop effect on the drag instance and updates the hasDragOver
        property.

        Parameters:
            drag - {O.Drag} The drag instance.
    */
    dropEntered: function ( drag ) {
        drag.set( 'dropEffect', this.get( 'dropEffect' ) );
        this.set( 'hasDragOver', true );
    },

    /**
        Method: O.DropTarget#dropMoved

        Called when a drag instance that has entered the view moves position
        (without exiting the view).

        Parameters:
            drag - {O.Drag} The drag instance.
    */
    dropMoved: function ( drag ) {},

    /**
        Method: O.DropTarget#dropExited

        Called when a drag instance exits the view.

        Resets the drop effect on the drag instance and updates the hasDragOver
        property.

        Parameters:
            drag - {O.Drag} The drag instance.
    */
    dropExited: function ( drag ) {
        drag.set( 'dropEffect', NS.DragEffect.MOVE );
        this.set( 'hasDragOver', false );
    },

    /**
        Method: O.DropTarget#drop

        Called when a drag instance is dropped on the view.

        Parameters:
            drag - {O.Drag} The drag instance.
    */
    drop: function ( drag ) {}
};

}( this.O ) );
