// -------------------------------------------------------------------------- \\
// File: UndoManager.js                                                       \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
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
        return this
            .set( 'canRedo', false )
            .set( 'canUndo', true )
            .fire( 'input' );
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
                this.undo();
            } else {
                var redoData = this.applyChange( this._undoStack.pop(), false );
                if ( redoData ) {
                    this._pushState( this._redoStack, redoData );
                }
                this.set( 'canUndo', !!this._undoStack.length )
                    .set( 'canRedo', !!redoData )
                    .fire( 'undo' );
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
                .set( 'canRedo', !!this._redoStack.length )
                .fire( 'redo' );
        }
        return this;
    },

    getUndoData: function () {},

    applyChange: function (/* data, isRedo */) {}
});

var StoreUndoManager = NS.Class({

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
        return store.hasChanges() ? store.getInverseChanges() : null;
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
        if ( this._isInUndoState || !this.get( 'store' ).hasChanges() ) {
            StoreUndoManager.parent.undo.call( this );
        }
        return this;
    }
});

NS.UndoManager = UndoManager;
NS.StoreUndoManager = StoreUndoManager;

}( O ) );
