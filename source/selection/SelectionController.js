import { Class, isDestroyed } from '../core/Core.js';
import { Obj } from '../foundation/Object.js';

/* { observes, property, nocache } from */
import '../foundation/Decorators.js';

const SelectionController = Class({
    Name: 'SelectionController',

    Extends: Obj,

    content: null,
    visible: null,

    init: function (/* ...mixins */) {
        this._selectionId = 0;
        this._lastSelectedIndex = 0;
        this._selectedStoreKeys = {};

        this.isLoadingSelection = false;
        this.length = 0;
        this.hasSelection = false;

        SelectionController.parent.constructor.apply(this, arguments);

        const content = this.get('content');
        if (content) {
            content.on('query:updated', this, 'contentWasUpdated');
        }
    },

    destroy() {
        const content = this.get('content');
        if (content) {
            content.off('query:updated', this, 'contentWasUpdated');
        }
        SelectionController.parent.destroy.call(this);
    },

    contentDidChange: function (_, __, oldContent, newContent) {
        if (oldContent) {
            oldContent.off('query:updated', this, 'contentWasUpdated');
        }
        if (newContent) {
            newContent.on('query:updated', this, 'contentWasUpdated');
        }
        this.selectNone();
    }.observes('content'),

    visibleDidChange: function () {
        this._lastSelectedIndex = 0;
    }.observes('visible'),

    contentWasUpdated(event) {
        // If an id has been removed, it may no
        // longer belong to the selection
        const _selectedStoreKeys = this._selectedStoreKeys;
        let length = this.get('length');
        const removed = event.removed;
        const added = new Set(event.added);

        for (let i = removed.length - 1; i >= 0; i -= 1) {
            const storeKey = removed[i];
            if (_selectedStoreKeys[storeKey] && !added.has(storeKey)) {
                length -= 1;
                delete _selectedStoreKeys[storeKey];
            }
        }

        this.set('length', length).propertyDidChange('selectedStoreKeys');
    },

    // ---

    selectedStoreKeys: function () {
        return Object.keys(this._selectedStoreKeys);
    }
        .property()
        .nocache(),

    isStoreKeySelected(storeKey) {
        return !!this._selectedStoreKeys[storeKey];
    },

    getSelectedRecords(store) {
        return this.get('selectedStoreKeys').map((storeKey) =>
            store.getRecordFromStoreKey(storeKey),
        );
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
            const wasSelected = !!_selectedStoreKeys[storeKey];
            if (isSelected !== wasSelected) {
                if (isSelected) {
                    _selectedStoreKeys[storeKey] = true;
                } else {
                    delete _selectedStoreKeys[storeKey];
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
        const lastSelectedIndex = this._lastSelectedIndex;
        const start = includeRangeFromLastSelected
            ? Math.min(index, lastSelectedIndex)
            : index;
        const end =
            (includeRangeFromLastSelected
                ? Math.max(index, lastSelectedIndex)
                : index) + 1;
        this._lastSelectedIndex = index;
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
            this._lastSelectedIndex = focusedIndex;
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
        this._lastSelectedIndex = 0;
        this._selectedStoreKeys = {};
        this.set('length', 0)
            .propertyDidChange('selectedStoreKeys')
            .set('isLoadingSelection', false)
            .setHasSelection();

        return this;
    },
});

export { SelectionController };
