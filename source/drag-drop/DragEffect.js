/**
    Enum: O.DragEffect

    NONE    - No effect when drag released.
    COPY    - Data will be copied to target.
    MOVE    - Data will be moved to target.
    LINK    - Data will be linked to by target.
    ALL     - Data may be copied, moved or linked by target.
    DEFAULT - The default browser action when released.
*/
export const NONE = 0;
export const COPY = 1;
export const MOVE = 2;
export const LINK = 4;
export const ALL = 1 | 2 | 4;
export const DEFAULT = 8;

/**
    Property: O.DragEffect.effectToString
    Type: String[]

    Maps bit mask effect to string
*/
export const effectToString = [
    'none',
    'copy',
    'move',
    'copyMove',
    'link',
    'copyLink',
    'linkMove',
    'all',
    '',
];
