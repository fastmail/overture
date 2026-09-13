import { Class, isDestroyed } from '../core/Core.js';
import { limit } from '../core/Math.js';
import { Obj } from '../foundation/Object.js';

/* { observes, property, nocache } from */
import '../foundation/Decorators.js';

// ---

const adjustIndex = (index, event) =>
    index +
    event.addedIndexes.binarySearch(index) -
    event.removedIndexes.binarySearch(index);

const SelectionController = Class({
    Name: 'SelectionController',

    Extends: Obj,

    content: null,
    visible: null,

    init: function (/* ...mixins */) {
        this._selectionId = 0;
        this._selectedStoreKeys = new Set();

        // Keep store key of the last selected item that wasn't selected by a
        // an "extend" action
        this._anchorIndex = -1;
        // Store key of last item we toggled selection for
        this._cursorIndex = 0;

        this.focused = null;
        this.isLoadingSelection = false;
        this.length = 0;
        this.hasSelection = false;

        SelectionController.parent.constructor.apply(this, arguments);

        const content = this.get('content');
        if (content) {
            content.on('query:updated', this, 'contentWasUpdated');
            content.on('query:idsLoaded', this, 'checkSelectionPresence');
        }
    },

    destroy() {
        const content = this.get('content');
        if (content) {
            content.off('query:updated', this, 'contentWasUpdated');
            content.off('query:idsLoaded', this, 'checkSelectionPresence');
        }
        SelectionController.parent.destroy.call(this);
    },

    contentDidChange: function (_, __, oldContent, newContent) {
        if (oldContent) {
            oldContent.off('query:updated', this, 'contentWasUpdated');
            oldContent.off('query:idsLoaded', this, 'checkSelectionPresence');
        }
        if (newContent) {
            newContent.on('query:updated', this, 'contentWasUpdated');
            newContent.on('query:idsLoaded', this, 'checkSelectionPresence');
        }
        this.selectNone();
    }.observes('content'),

    visibleDidChange: function () {
        this._anchorIndex = -1;
        this._cursorIndex = 0;
    }.observes('visible'),

    contentWasUpdated(event) {
        // If an id has been removed, it may no longer belong to the selection
        const _selectedStoreKeys = this._selectedStoreKeys;
        let length = this.get('length');
        const removed = event.removed;
        const added = new Set(event.added);

        for (let i = removed.length - 1; i >= 0; i -= 1) {
            const storeKey = removed[i];
            if (_selectedStoreKeys.has(storeKey) && !added.has(storeKey)) {
                length -= 1;
                _selectedStoreKeys.delete(storeKey);
            }
        }

        this._anchorIndex = adjustIndex(this._anchorIndex, event);
        this._cursorIndex = adjustIndex(this._cursorIndex, event);

        this.set('length', length).propertyDidChange('selectedStoreKeys');
    },

    checkSelectionPresence(event) {
        if (!event.isStateChange) {
            return;
        }
        const _selectedStoreKeys = this._selectedStoreKeys;
        if (!_selectedStoreKeys.size) {
            return;
        }
        const knownStoreKeys = new Set(this.get('content').getStoreKeys());
        for (const storeKey of _selectedStoreKeys) {
            if (!knownStoreKeys.has(storeKey)) {
                _selectedStoreKeys.delete(storeKey);
            }
        }
        if (_selectedStoreKeys.size !== this.get('length')) {
            this.set('length', _selectedStoreKeys.size).propertyDidChange(
                'selectedStoreKeys',
            );
        }
    },

    // ---

    selectedStoreKeys: function () {
        return [...this._selectedStoreKeys];
    }
        .property()
        .nocache(),

    isStoreKeySelected(storeKey) {
        return this._selectedStoreKeys.has(storeKey);
    },

    getSelectedRecords(store) {
        return this.get('selectedStoreKeys').map((storeKey) =>
            store.getRecordFromStoreKey(storeKey),
        );
    },

    // The index of the first and last selected task in the current view,
    // plus whether everything between the two is selected as well:
    // [first, last, isContiguous], or null if nothing is selected.
    getBounds() {
        if (!this.get('length')) {
            return null;
        }
        const query = this.get('visible') || this.get('content');
        const _selectedStoreKeys = this._selectedStoreKeys;
        let first = -1;
        let last = -1;
        let isContiguous = true;
        if (_selectedStoreKeys.size < 16) {
            const indexes = [..._selectedStoreKeys]
                .map((storeKey) => query.indexOfStoreKey(storeKey))
                .sort((a, b) => a - b);
            const lastIndex = indexes.length - 1;
            first = indexes[0];
            last = indexes[lastIndex];
            isContiguous = last - first === lastIndex;
        } else {
            for (let i = 0, l = query.get('length'); i < l; i += 1) {
                const item = query.getObjectAt(i);
                if (item && _selectedStoreKeys.has(item.get('storeKey'))) {
                    if (first === -1) {
                        first = i;
                    } else if (i !== last + 1) {
                        isContiguous = false;
                    }
                    last = i;
                }
            }
        }
        return first === -1 ? null : [first, last, isContiguous];
    },

    // ---

    setHasSelection: function () {
        this.set('hasSelection', !!this.get('length'));
    }.observes('length'),

    // ---

    selectStoreKeys(storeKeys, isSelected, _selectionId) {
        if (
            (_selectionId && _selectionId !== this._selectionId) ||
            isDestroyed(this)
        ) {
            return;
        }
        // Make sure we've got a boolean
        isSelected = !!isSelected;

        const _selectedStoreKeys = this._selectedStoreKeys;
        let howManyChanged = 0;

        for (let i = storeKeys.length - 1; i >= 0; i -= 1) {
            const storeKey = storeKeys[i];
            if (!storeKey) {
                continue;
            }
            const wasSelected = _selectedStoreKeys.has(storeKey);
            if (isSelected !== wasSelected) {
                if (isSelected) {
                    _selectedStoreKeys.add(storeKey);
                } else {
                    _selectedStoreKeys.delete(storeKey);
                }
                howManyChanged += 1;
            }
        }

        if (howManyChanged) {
            this.increment(
                'length',
                isSelected ? howManyChanged : -howManyChanged,
            ).propertyDidChange('selectedStoreKeys');
        }

        this.set('isLoadingSelection', false);
    },

    selectIndex(index, isSelected, includeRangeFromLastSelected) {
        const cursorIndex = this._cursorIndex;
        const start = includeRangeFromLastSelected
            ? Math.min(index, cursorIndex)
            : index;
        const end =
            (includeRangeFromLastSelected
                ? Math.max(index, cursorIndex)
                : index) + 1;
        this._cursorIndex = index;
        if (isSelected) {
            this._anchorIndex = index;
        }
        this.focused?.set('index', index);
        return this.selectRange(start, end, isSelected);
    },

    selectRange(start, end, isSelected) {
        const query = this.get('visible') || this.get('content');
        const selectionId = (this._selectionId += 1);
        const loading = query.getStoreKeysForObjectsInRange(
            start,
            Math.min(end, query.get('length') || 0),
            (storeKeys, _start, _end) => {
                this.selectStoreKeys(
                    storeKeys,
                    isSelected,
                    selectionId,
                    _start,
                    _end,
                );
            },
        );

        if (loading) {
            this.set('isLoadingSelection', true);
        }

        return this;
    },

    selectIndexWithFocusedItem(
        index,
        isSelected,
        includeRangeFromLastSelected,
        focusedIndex,
    ) {
        if (
            includeRangeFromLastSelected &&
            typeof focusedIndex === 'number' &&
            focusedIndex > -1 &&
            !this.get('length')
        ) {
            this._cursorIndex = focusedIndex;
        }

        return this.selectIndex(
            index,
            isSelected,
            includeRangeFromLastSelected,
        );
    },

    selectAll() {
        const query = this.get('visible') || this.get('content');
        const selectionId = (this._selectionId += 1);
        const loading = query.getStoreKeysForAllObjects(
            (storeKeys, start, end) => {
                this.selectStoreKeys(storeKeys, true, selectionId, start, end);
            },
        );

        if (loading) {
            this.set('isLoadingSelection', true);
        }

        return this;
    },

    selectNone() {
        this._anchorIndex = -1;
        this._cursorIndex = 0;
        this._selectedStoreKeys = new Set();
        this.set('length', 0)
            .propertyDidChange('selectedStoreKeys')
            .set('isLoadingSelection', false)
            .setHasSelection();

        return this;
    },

    // ---

    selectOne(delta) {
        if (this.focused) {
            this.focused.moveSelection(delta);
            return;
        }
        const query = this.get('visible') || this.get('content');
        const length = query.get('length');
        if (!length) {
            return;
        }
        const indexes = this.getBounds();
        let index = 0;
        if (!indexes) {
            // With nothing selected, start from the near end of the list.
            index = delta > 0 ? 0 : length - 1;
        } else {
            // Otherwise, we select the first item before the selection if going
            // up and the first item below the selection if going down, clamped
            // to the query range
            const [first, last] = indexes;
            index = limit((delta > 0 ? last : first) + delta, 0, length - 1);
        }
        this.selectNone();
        this.selectIndex(index, true, false);
    },

    selectUp() {
        this.selectOne(-1);
    },

    selectDown() {
        this.selectOne(1);
    },

    // ---

    extendSelectionUp() {
        if (this.focused && !this.get('length')) {
            const index = this.focused.get('index');
            if (index > -1) {
                this.selectIndex(index, true, false);
            }
        }
        if (!this.get('length')) {
            this.selectUp();
        } else {
            this.extendSelection(this._cursorIndex - 1);
        }
    },

    extendSelectionDown() {
        if (this.focused && !this.get('length')) {
            const index = this.focused.get('index');
            if (index > -1) {
                this.selectIndex(index, true, false);
            }
        }
        if (!this.get('length')) {
            this.selectDown();
        } else {
            this.extendSelection(this._cursorIndex + 1);
        }
    },

    extendSelection(toIndex) {
        if (!this.get('length')) {
            this.selectIndex(toIndex, true);
            return;
        }
        const anchorIndex = this._anchorIndex;
        const cursorIndex = this._cursorIndex;
        if (
            Math.abs(anchorIndex - toIndex) <
            Math.abs(anchorIndex - cursorIndex)
        ) {
            // Moving towards anchor, deselect
            if (cursorIndex < anchorIndex) {
                this.selectRange(cursorIndex, toIndex, false);
            } else {
                this.selectRange(toIndex + 1, cursorIndex + 1, false);
            }
        } else {
            const query = this.get('visible') || this.get('content');
            const storeKeys = query.getStoreKeys();
            // Moving away from anchor, select
            if (toIndex < anchorIndex) {
                // Find the next unselected in this direction
                while (
                    toIndex > 0 &&
                    this.isStoreKeySelected(storeKeys[toIndex])
                ) {
                    toIndex -= 1;
                }
                this.selectRange(toIndex, anchorIndex, true);
            } else {
                // Find the next unselected in this direction
                const maxIndex = query.get('length') - 1;
                while (
                    toIndex < maxIndex &&
                    this.isStoreKeySelected(storeKeys[toIndex])
                ) {
                    toIndex += 1;
                }
                this.selectRange(anchorIndex + 1, toIndex + 1, true);
            }
        }
        this.focused?.set('index', toIndex);
        this._cursorIndex = toIndex;
    },
});

export { SelectionController };
