import { Class } from '../../core/Core';
import Obj from '../../foundation/Object';

/**
    Class: O.UndoManager
*/

const UndoManager = Class({

    Extends: Obj,

    init (/* ...mixins */) {
        this._undoStack = [];
        this._redoStack = [];

        this._isInUndoState = false;

        this.canUndo = false;
        this.canRedo = false;

        this.maxUndoCount = 1;

        UndoManager.parent.constructor.apply( this, arguments );
    },

    _pushState ( stack, data ) {
        stack.push( data );
        while ( stack.length > this.maxUndoCount ) {
            stack.shift();
        }
        this._isInUndoState = true;
    },

    dataDidChange () {
        this._isInUndoState = false;
        this._redoStack.length = 0;
        return this
            .set( 'canRedo', false )
            .set( 'canUndo', true )
            .fire( 'input' );
    },

    saveUndoCheckpoint () {
        if ( !this._isInUndoState ) {
            const data = this.getUndoData();
            if ( data !== null ) {
                this._pushState( this._undoStack, data );
            } else {
                this._isInUndoState = true;
                this.set( 'canUndo', !!this._undoStack.length );
            }
        }
        return this;
    },

    undo () {
        if ( this.get( 'canUndo' ) ) {
            if ( !this._isInUndoState ) {
                this.saveUndoCheckpoint();
                this.undo();
            } else {
                const redoData = this.applyChange(
                    this._undoStack.pop(), false );
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

    redo () {
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

    getUndoData () {},

    applyChange (/* data, isRedo */) {},
});

export default UndoManager;
