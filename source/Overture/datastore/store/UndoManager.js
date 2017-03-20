// -------------------------------------------------------------------------- \\
// File: UndoManager.js                                                       \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../../core/Core.js';
import Object from '../../foundation/Object.js';

/**
    Class: O.UndoManager
*/

var UndoManager = Class({

    Extends: Object,

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

    applyChange: function (/* data, isRedo */) {},
});

export default UndoManager;
