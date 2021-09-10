import { Class } from '../../core/Core.js';
import { UndoManager } from './UndoManager.js';

const StoreUndoManager = Class({
    Name: 'StoreUndoManager',

    Extends: UndoManager,

    init: function (/* ...mixins */) {
        StoreUndoManager.parent.constructor.apply(this, arguments);
        this.get('store')
            .on('willCommit', this, '_saveUndoCheckpoint')
            .on('record:user:create', this, 'dataDidChange')
            .on('record:user:update', this, 'dataDidChange')
            .on('record:user:destroy', this, 'dataDidChange');
    },

    destroy() {
        this.get('store')
            .off('willCommit', this, '_saveUndoCheckpoint')
            .off('record:user:create', this, 'dataDidChange')
            .off('record:user:update', this, 'dataDidChange')
            .off('record:user:destroy', this, 'dataDidChange');
        StoreUndoManager.parent.destroy.call(this);
    },

    // Avoid passing event argument to saveUndoCheckpoint method
    _saveUndoCheckpoint() {
        this.saveUndoCheckpoint();
    },

    dataDidChange() {
        const noChanges = !this.get('store')
            .checkForChanges()
            .get('hasChanges');
        this._isInUndoState = noChanges;
        return this.set('canRedo', noChanges && !!this._redoStack.length)
            .set('canUndo', noChanges && !!this._undoStack.length)
            .fire('input');
    },

    getUndoData() {
        const store = this.get('store');
        return store.checkForChanges().get('hasChanges')
            ? store.getInverseChanges()
            : null;
    },

    applyChange(data) {
        const store = this.get('store');
        store.applyChanges(data);
        const inverse = store.getInverseChanges();
        store.commitChanges();
        return inverse;
    },
});

export { StoreUndoManager };
