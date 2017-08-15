import Obj from '../foundation/Object.js';

/**
    Property: O.activeViews
    Type: O.Object

    Maps from id to the view object for all views currently in a document.

    Views with a manually specified ID are added using <O.ComputedProps#set>,
    and so you can observe them.

    For reasons of performance, views with automatically-generated IDs ('v1',
    'v372', &c.) bypass <O.ComputedProps#set>, and so they cannot be observed.
    (I can’t think of any legitimate reasons for observing them anyway.)

    This object is maintained by <O.View#didEnterDocument> and
    <O.View#willLeaveDocument>; no code outside of those two methods is
    permitted to mutate it.
*/
const activeViews = new Obj();
export default activeViews;

/**
    Function: O.getViewFromNode

    Returns the view object that the given DOM node is a part of.

    Parameters:
        node - {Element} a DOM node.

    Returns:
        {O.View|null} The view which owns the node.
*/
export const getViewFromNode = function ( node ) {
    const doc = node.ownerDocument;
    let view = null;
    while ( !view && node && node !== doc ) {
        view = activeViews[ node.id ];
        node = node.parentNode;
    }
    return view;
};
