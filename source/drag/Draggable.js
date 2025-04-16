/**
    Mixin: O.Draggable

    The Draggable mixin should be applied to views you wish to make draggable.
    Override the methods to get the callbacks you're interested in.
*/
const Draggable = {
    /**
        Property: O.Draggable#isDraggable
        Type: Boolean
        Default: true

        Identifies the view as draggable.
    */
    isDraggable: true,

    /**
        Property: O.Draggable#isDragging
        Type: Boolean

        True if the view is currently being dragged.
    */
    isDragging: false,

    /**
        Property: O.Draggable#isTouchDraggable
        Type: Boolean
        Default: true

        If true, the view will initiate drag-drop on touch hold.
    */
    isTouchDraggable: true,

    /**
        Method: O.Draggable#dragStarted

        Called when a drag is initiated with this view.

        Parameters:
            drag - {O.Drag} The drag instance.
    */
    dragStarted(/* drag */) {},

    /**
        Method: O.Draggable#dragMoved

        Called when a drag initiated with this view moves.

        Parameters:
            drag - {O.Drag} The drag instance.
    */
    dragMoved(/* drag */) {},

    /**
        Method: O.Draggable#dragEnded

        Called when a drag initiated with this view finishes (no matter where on
        screen it finishes). This method is guaranteed to be called, if and only
        if dragStarted was called on the same view.

        Parameters:
            drag - {O.Drag} The drag instance.
    */
    dragEnded(/* drag */) {},
};

export { Draggable };
