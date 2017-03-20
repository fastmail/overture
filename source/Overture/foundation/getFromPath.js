/**
    Function: O.getFromPath

    Follows a path string (e.g. 'mailbox.messages.howMany') to retrieve the
    final object/value from a root object. At each stage of the path, if the
    current object supports a 'get' function, that will be used to retrieve the
    next stage, otherwise it will just be read directly as a property.

    If the full path cannot be followed, `undefined` will be returned.

    Parameters:
        root - {Object} The root object the path is relative to.
        path - {String} The path to retrieve the value from.

    Returns:
        {*} Returns the value at the end of the path.
*/
const isNum = /^\d+$/;
export default function getFromPath ( root, path ) {
    let currentPosition = 0;
    const pathLength = path.length;
    while ( currentPosition < pathLength ) {
        if ( !root ) {
            return undefined;
        }
        let nextDot = path.indexOf( '.', currentPosition );
        if ( nextDot === -1 ) { nextDot = pathLength; }
        const key = path.slice( currentPosition, nextDot );
        root = root.getObjectAt && isNum.test( key ) ?
            root.getObjectAt( +key ) :
            root.get ?
                root.get( key ) :
                root[ key ];
        currentPosition = nextDot + 1;
    }
    return root;
}
