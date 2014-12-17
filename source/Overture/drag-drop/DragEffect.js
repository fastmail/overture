// -------------------------------------------------------------------------- \\
// File: DragEffect.js                                                        \\
// Module: DragDrop                                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

O.DragEffect = {
/**
    Enum: O.DragEffect

    NONE    - No effect when drag released.
    COPY    - Data will be copied to target.
    MOVE    - Data will be moved to target.
    LINK    - Data will be linked to by target.
    ALL     - Data may be copied, moved or linked by target.
    DEFAULT - The default browser action when released.
*/
    NONE: 0,
    COPY: 1,
    MOVE: 2,
    LINK: 4,
    ALL: 1|2|4,
    DEFAULT: 8,

/**
    Property: O.DragEffect.effectToString
    Type: Array.<String>

    Maps bit mask effect to string
*/
    effectToString:  [
        'none',
        'copy',
        'move',
        'copyMove',
        'link',
        'copyLink',
        'linkMove',
        'all',
        ''
    ]
};
