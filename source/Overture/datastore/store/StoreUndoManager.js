import { Class } from '../../core/Core.js';

import UndoManager from './UndoManager.js';

var StoreUndoManager = Class({

    Extends: UndoManager,

    init: function ( mixin ) {
        StoreUndoManager.parent.init.call( this, mixin );
        this.get( 'store' )
            .on( 'willCommit', this, 'saveUndoCheckpoint' )
            .on( 'record:user:create', this, 'dataDidChange' )
            .on( 'record:user:update', this, 'dataDidChange' )
            .on( 'record:user:destroy', this, 'dataDidChange' );
    },

    destroy: function () {
        this.get( 'store' )
            .off( 'willCommit', this, 'saveUndoCheckpoint' )
            .off( 'record:user:create', this, 'dataDidChange' )
            .off( 'record:user:update', this, 'dataDidChange' )
            .off( 'record:user:destroy', this, 'dataDidChange' );
        StoreUndoManager.parent.destroy.call( this );
    },

    getUndoData: function () {
        var store = this.get( 'store' );
        return store.checkForChanges().get( 'hasChanges' ) ?
            store.getInverseChanges() : null;
    },

    applyChange: function ( data ) {
        var store = this.get( 'store' ),
            inverse;
        store.applyChanges( data );
        inverse = store.getInverseChanges();
        store.commitChanges();
        return inverse;
    },

    undo: function () {
        if ( this._isInUndoState || !this.get( 'store' ).get( 'hasChanges' ) ) {
            StoreUndoManager.parent.undo.call( this );
        }
        return this;
    },
});

export default StoreUndoManager;
