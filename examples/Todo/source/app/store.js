import { Store, StoreUndoManager } from '/overture/datastore';

import { source } from './source.js';

/*  The store instance stores the locally cached copies of the different
    records in the model. It keeps track of what has changed compared to the
    copy received from the source, and can then send those changes to the source
    to be committed. It can keep track of further changes whilst the current
    ones are being committed and resolve things when the commit succeeds or
    fails.

    I've turned off auto-commit, so it will only send changes to the store when
    Store#commitChanges is explicitly called. This is because when editing
    todos, the text field is just bound directly to the summary in the model,
    and we don't want it to commit on every keystroke; just when the user has
    finished editing.

    In more complex apps, you would often use an NestedStore to create a
    copy-on-write view of the original store. This allows you to edit stuff
    and commit it back independently; I've kept it simpler here.
*/
const store = new Store({
    source,
    autoCommit: false,
    getPrimaryAccountIdForType (/* Type */) {
        return 'todo';
    },
});

store.addAccount ( 'todo', {
    accountCapabilities: {
        'https://overturejs.com/Todo/': {}
    },
});

/* A StoreUndoManager hooks into the store to provide automatic undo support.
   Each time the store commits changes to the source, the UndoManager
   automatically records an undo checkpoint.
*/
const undoManager = new StoreUndoManager({
    store,
    maxUndoCount: 10
});

export { store, undoManager };
