import { Class } from '../../core/Core.js';

import UndoManager from './UndoManager.js';

const StoreUndoManager = Class({

    Extends: UndoManager,

    init ( mixin ) {
        StoreUndoManager.parent.init.call( this, mixin );
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

    undo () {
        if ( this._isInUndoState || !this.get( 'store' ).get( 'hasChanges' ) ) {
            StoreUndoManager.parent.undo.call( this );
        }
        return this;
    },
});

export default StoreUndoManager;
