import DragEffect from './DragEffect.js';

/**
    Class: O.DragDataSource

    Represents a set of data for a drag operation. This can either be
    instantiated like so:

        var ddsource = new O.DragDataSource({
            'text/plain': 'My *data*',
            'text/html': 'My <strong>data</strong>'
        });

    or used as a mixin in another class.
*/
export default {
    /**
        Constructor: O.DragDataSource

        Parameters:
            dragData - {Object} An object with data types as keys and the data
                       itself as the values.
    */
    init: function ( dragData ) {
        if ( !dragData ) { dragData = {}; }
        this._dragData = dragData;
        this.dragDataTypes = Object.keys( dragData );
        this.get = function ( key ) {
            return this[ key ];
        };
    },

    /**
        Property: O.DragDataSource#isDragDataSource
        Type: Boolean
        Default: true

        Identifies the object as a drag data source, even if used as a mixin.
    */
    isDragDataSource: true,

    /**
        Property: O.DragDataSource#allowedDragEffects
        Type: O.DragEffect
        Default: O.DragEffect.ALL

        The effects allowed on the data.
    */
    allowedDragEffects: DragEffect.ALL,

    /**
        Property: O.DragDataSource#dragDataTypes
        Type: String[]

        The list of data types available in this data source.
    */
    dragDataTypes: [],

    /**
        Method: O.DragController.getDragDataOfType

        Parameters:
            type - {String} The data type required.
            drag - {O.Drag} The drag instance representing the data.

        Returns:
            {*} The data of the requested type, if available.
    */
    getDragDataOfType: function ( type/*, drag*/ ) {
        return this._dragData[ type ];
    },
};
