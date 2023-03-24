/**
    Enum: O.Status

    EMPTY        - The record has no data loaded.
    READY        - The record has data loaded and may be used.
    DESTROYED    - The record is destroyed.
    NON_EXISTENT - No record of this type with this id exists in the source.
    LOADING      - A request for the record's data is in progress.
    COMMITTING   - Changes are currently being committed to the source.
    NEW          - The record is new and has not been committed to the source.
    DIRTY        - Changes have been made to the record which have not yet been
                   committed to the source.
    OBSOLETE     - Changes may have been made to the record in the source which
                   have not yet loaded.
    UNSAVED      - Sugar for READY|NEW|DIRTY - the record has not yet been
                   committed to the store.
*/

// Core states:
export const EMPTY = 1 << 0;
export const READY = 1 << 1;
export const DESTROYED = 1 << 2;
export const NON_EXISTENT = 1 << 3;

// Properties:
export const LOADING = 1 << 4;
export const COMMITTING = 1 << 5;
export const NEW = 1 << 6;
export const DIRTY = 1 << 7;
export const OBSOLETE = 1 << 8;

// Sugar
export const UNSAVED = READY | NEW | DIRTY;
