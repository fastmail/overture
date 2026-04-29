/**
    Property: O.activeViews
    Type: Map

    Maps from id to the view object for all views currently in a document.
*/
const activeViews = new Map();

/**
    Function: O.getViewFromNode

    Returns the view object that the given DOM node is a part of.

    Parameters:
        node - {Element} a DOM node.

    Returns:
        {O.View|null} The view which owns the node.
*/
const getViewFromNode = function (node) {
    const doc = node.ownerDocument;
    let view = null;
    while (!view && node && node !== doc) {
        view = activeViews.get(node.id) || null;
        node = node.parentNode;
    }
    return view;
};

export { activeViews, getViewFromNode };
