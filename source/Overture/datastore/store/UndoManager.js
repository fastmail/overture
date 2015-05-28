// -------------------------------------------------------------------------- \\
// File: UndoManager.js                                                       \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Class: O.UndoManager
*/

var UndoManager = NS.Class({

    Extends: NS.Object,

    init: function ( mixin ) {
        this._undoStack = [];
        this._redoStack = [];

        this._isInUndoState = false;

        this.canUndo = false;
        this.canRedo = false;

        this.maxUndoCount = 1;

        UndoManager.parent.init.call( this, mixin );
    },

    _pushState: function ( stack, data ) {
        stack.push( data );
        while ( stack.length > this.maxUndoCount ) {
            stack.shift();
        }
        this._isInUndoState = true;
    },

    dataDidChange: function () {
        this._isInUndoState = false;
        this._redoStack.length = 0;
        this.set( 'canRedo', false )
            .set( 'canUndo', true );
        return this;
    },

    saveUndoCheckpoint: function () {
        if ( !this._isInUndoState ) {
            var data = this.getUndoData();
            if ( data !== null ) {
                this._pushState( this._undoStack, data );
            } else {
                this._isInUndoState = true;
                this.set( 'canUndo', !!this._undoStack.length );
            }
        }
        return this;
    },

    undo: function () {
        if ( this.get( 'canUndo' ) ) {
            if ( !this._isInUndoState ) {
                this.saveUndoCheckpoint();
                return this.undo();
            } else {
                this._pushState( this._redoStack,
                    this.applyChange( this._undoStack.pop(), false )
                );
                this.set( 'canUndo', !!this._undoStack.length )
                    .set( 'canRedo', true );
            }
        }
        return this;
    },

    redo: function () {
        if ( this.get( 'canRedo' ) ) {
            this._pushState( this._undoStack,
                this.applyChange( this._redoStack.pop(), true )
            );
            this.set( 'canUndo', true )
                .set( 'canRedo', !!this._redoStack.length );
        }
        return this;
    },

    getUndoData: function () {},

    applyChange: function (/* data, isRedo */) {}
});

var StoreUndoManager = NS.Class({

    Extends: UndoManager,

    init: function ( mixin ) {
        var store = mixin.store;
        store.on( 'willCommit', this, 'saveUndoCheckpoint' )
             .on( 'record:user:create', this, 'dataDidChange' )
             .on( 'record:user:update', this, 'dataDidChange' )
             .on( 'record:user:destroy', this, 'dataDidChange' );
        StoreUndoManager.parent.init.call( this, mixin );
    },

    destroy: function () {
        this.store.off( 'willCommit', this, 'saveUndoCheckpoint' )
                  .off( 'record:user:create', this, 'dataDidChange' )
                  .off( 'record:user:update', this, 'dataDidChange' )
                  .off( 'record:user:destroy', this, 'dataDidChange' );
        StoreUndoManager.parent.destroy.call( this );
    },

    getUndoData: function () {
        var store = this.store;
        return store.hasChanges() ? store.getInverseChanges() : null;
    },

    applyChange: function ( data ) {
        var store = this.store,
            inverse;
        store.applyChanges( data );
        inverse = store.getInverseChanges();
        store.commitChanges();
        return inverse;
    }
});

NS.UndoManager = UndoManager;
NS.StoreUndoManager = StoreUndoManager;

}( O ) );
