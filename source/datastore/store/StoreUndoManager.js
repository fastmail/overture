import { Class } from '../../core/Core';

import UndoManager from './UndoManager';

const StoreUndoManager = Class({

    Extends: UndoManager,

    init (/* ...mixins */) {
        StoreUndoManager.parent.constructor.apply( this, arguments );
        this.get( 'store' )
            .on( 'willCommit', this, 'saveUndoCheckpoint' )
            .on( 'record:user:create', this, 'dataDidChange' )
            .on( 'record:user:update', this, 'dataDidChange' )
            .on( 'record:user:destroy', this, 'dataDidChange' );
    },

    destroy () {
        this.get( 'store' )
            .off( 'willCommit', this, 'saveUndoCheckpoint' )
            .off( 'record:user:create', this, 'dataDidChange' )
            .off( 'record:user:update', this, 'dataDidChange' )
            .off( 'record:user:destroy', this, 'dataDidChange' );
        StoreUndoManager.parent.destroy.call( this );
    },

    dataDidChange: function () {
        const noChanges =
            !this.get( 'store' ).checkForChanges().get( 'hasChanges' );
        this._isInUndoState = noChanges;
        return this
            .set( 'canRedo', noChanges && !!this._redoStack.length )
            .set( 'canUndo', noChanges && !!this._undoStack.length )
            .fire( 'input' );
    },

    getUndoData () {
        const store = this.get( 'store' );
        return store.checkForChanges().get( 'hasChanges' ) ?
            store.getInverseChanges() : null;
    },

    applyChange ( data ) {
        const store = this.get( 'store' );
        store.applyChanges( data );
        const inverse = store.getInverseChanges();
        store.commitChanges();
        return inverse;
    },
});

export default StoreUndoManager;
