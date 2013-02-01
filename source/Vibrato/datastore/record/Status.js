// -------------------------------------------------------------------------- \\
// File: Status.js                                                            \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

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
                   have not yet been fetched.
*/
this.O.Status = {
    // Core states:
    EMPTY:        1,
    READY:        2,
    DESTROYED:    4,
    NON_EXISTENT: 8,

    // Properties:
    LOADING:     16,
    COMMITTING:  32,
    NEW:         64,
    DIRTY:      128,
    OBSOLETE:   256
};
