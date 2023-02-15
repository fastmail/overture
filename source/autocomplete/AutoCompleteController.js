import { Class, isEqual } from '../core/Core.js';
import { mod } from '../core/Math.js';
import { lookupKey } from '../dom/DOMEvent.js';
import { AggregateEnumerable } from '../foundation/AggregateEnumerable.js';
import { bind } from '../foundation/Binding.js';
import { Obj } from '../foundation/Object.js';
import { AutoCompleteView } from '../views/autocomplete/AutoCompleteView.js';
import { ScrollView } from '../views/containers/ScrollView.js';
import { PopOverView } from '../views/panels/PopOverView.js';
import { ViewEventsController } from '../views/ViewEventsController.js';

// ---

const OptionsFocusedController = Class({
    Name: 'OptionsFocusedController',

    Extends: Obj,

    record: null,
    list: null,

    getAdjacent(step) {
        const list = this.get('list');
        const l = list.get('length');
        let i = list.indexOf(this.get('record'));

        if (!l) {
            return undefined;
        }

        if (i < 0 && step < 0) {
            i = l;
        }
        i = mod(i + step, l);
        return list.getObjectAt(i);
    },

    focusPrevious() {
        return this.focus(this.getAdjacent(-1));
    },

    focusNext() {
        return this.focus(this.getAdjacent(1));
    },

    focus(record) {
        this.set('record', record);
    },
});

const AutoCompleteController = Class({
    Name: 'AutoCompleteController',

    Extends: Obj,

    showGhost: true,
    autoFocus: false,

    init: function () {
        AutoCompleteController.parent.init.apply(this, arguments);
        this.inputView = null;
        this.isVisible = false;
        this.context = null;
        this.suggestions = { top: null, middle: null, bottom: null };
    },

    /** @type {AutoCompleteSuggestionSource[]} */
    sources: [],

    focused: function () {
        return new OptionsFocusedController();
    }.property(),

    // ---

    popOver: function () {
        return new PopOverView();
    }.property(),
    popOverOptions: {},

    view: function () {
        return new AutoCompleteView({
            controller: this,
            suggestions: bind(this, 'suggestions'),
        });
    }.property(),

    // ---

    /**
     * Override in subclasses to return richer context, e.g. parsed search as
     * well as full text and selection
     */
    getContext(text, selection) {
        return { controller: this, text, selection };
    },

    contextNeedsUpdate(text, selection) {
        const context = this.get('context');
        return (
            !context ||
            context.text !== text ||
            !isEqual(context.selection, selection)
        );
    },

    /**
     * Called when any of the following changes:
     * - `inputView.isFocused`
     * - `inputView.selection`
     * - `inputView.value`
     */
    updateContext() {
        const inputView = this.get('inputView');
        const text = inputView.get('value');
        const selection = inputView.get('selection');
        if (this.contextNeedsUpdate(text, selection)) {
            const context = this.getContext(text, selection);
            this.set('context', context).updateSuggestions();
        } else if (this.getFromPath('focused.list.length')) {
            this.set('isVisible', true);
        }
    },

    updateSuggestions() {
        const context = this.get('context');
        const top = [];
        const middle = [];
        const bottom = [];
        const aggregate = [];
        if (context) {
            for (const source of this.get('sources')) {
                const suggestions = source.getSuggestions(context);
                if (suggestions?.length) {
                    switch (source.pinTo) {
                        case 'top':
                            top.push({ source, suggestions });
                            break;
                        case 'bottom':
                            bottom.push({ source, suggestions });
                            break;
                        default:
                            middle.push({ source, suggestions });
                            break;
                    }
                    aggregate.push(suggestions);
                }
            }
        }
        const allSuggestions = new AggregateEnumerable(aggregate);
        this.set('suggestions', {
            top: top.length ? top : null,
            middle: middle.length ? middle : null,
            bottom: bottom.length ? bottom : null,
        });
        this.get('focused')
            .set('list', allSuggestions)
            .set(
                'record',
                this.get('autoFocus') ? allSuggestions.first() : null,
            );
        return this.set('isVisible', !!aggregate.length);
    },

    isVisibleDidChange: function (_, __, wasVisible) {
        const popOver = this.get('popOver');
        const isVisible = this.get('isVisible');
        const inputView = this.get('inputView');
        const scrollView = inputView.getParent(ScrollView);
        if (isVisible && !wasVisible) {
            // Show popover
            const autoCompleteView = this.get('view');
            popOver.show({
                className: 'u-overflow-hidden',
                view: autoCompleteView,
                alignWithView: inputView,
                alignEdge: 'left',
                offsetTop: 0,
                allowEventsOutside: true,
                resistHiding: true,
                ...this.get('popOverOptions'),
            });
            if (scrollView) {
                scrollView.addObserverForKey('scrollTop', popOver, 'didResize');
            }
            inputView.addObserverForKey('pxLayout', popOver, 'didResize');
        } else if (!isVisible && wasVisible) {
            // Hide popover
            if (scrollView) {
                scrollView.removeObserverForKey(
                    'scrollTop',
                    popOver,
                    'didResize',
                );
            }
            inputView.removeObserverForKey('pxLayout', popOver, 'didResize');
            popOver.hide();
        }
    }.observes('isVisible'),

    // When input focused:
    attach(inputView) {
        this.detach();
        this.set('inputView', inputView);
        inputView
            .addObserverForKey('selection', this, 'updateContext')
            .addObserverForKey('value', this, 'updateContext')
            .addObserverForKey('isInDocument', this, 'detach');
        ViewEventsController.addEventTarget(this, 15);
        this.get('focused').addObserverForKey('record', this, 'setGhost');
        this.updateContext();
    },

    detach() {
        const inputView = this.get('inputView');
        if (inputView) {
            this.set('isVisible', false);
            this.get('focused').removeObserverForKey(
                'record',
                this,
                'setGhost',
            );
            ViewEventsController.removeEventTarget(this);
            inputView
                .removeObserverForKey('isInDocument', this, 'detach')
                .removeObserverForKey('value', this, 'updateContext')
                .removeObserverForKey('selection', this, 'updateContext');
            this.set('inputView', null);
        }
    },

    setGhost: function () {
        let ghost = null;
        if (this.get('showGhost') && this.get('isVisible')) {
            const record = this.getFromPath('focused.record');
            const context = this.get('context');
            if (record && context) {
                ghost = record.getChange(context);
            }
        }
        this.inputView.set('ghost', ghost);
    }.observes('isVisible'),

    // Rather than detaching on blur, we check if we are blurred after a click
    // or keydown. This allows us to activate autocomplete options on click
    // rather than having to use mousedown, which is better for accessibility.
    autoDetach: function () {
        const inputView = this.get('inputView');
        if (inputView && !inputView.get('isFocused')) {
            this.detach();
        }
    }
        .queue('after')
        .on('blur'),

    // If key is up/down/enter, intercept and preventDefault/stopPropagation if
    // necessary
    keydown: function (event) {
        if (!this.get('isVisible')) {
            return;
        }
        let shouldSubmit = true;
        const focused = this.get('focused');
        switch (lookupKey(event)) {
            case 'Tab':
                shouldSubmit = false;
            /* falls through */
            case 'Enter': {
                const suggestion = focused.get('record');
                if (!suggestion) {
                    this.submit();
                    return;
                }
                this.select(suggestion, shouldSubmit);
                break;
            }
            case 'ArrowUp':
                focused.focusPrevious();
                break;
            case 'ArrowDown':
                focused.focusNext();
                break;
            case 'Escape':
                break;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
    }.on('keydown'),

    keyup: function (event) {
        if (lookupKey(event) === 'Escape' && this.get('isVisible')) {
            this.set('isVisible', false);
            event.preventDefault();
            event.stopPropagation();
        }
    }.on('keyup'),

    allowEventsInPopOver: function (event) {
        const view = this.get('view');
        if (event.targetView?.getParentWhere((x) => x === view)) {
            event.seenByModal = true;
        }
    }.on('click', 'mousedown', 'mouseup', 'tap', 'wheel'),

    select(suggestion, shouldSubmit) {
        const context = this.get('context');
        if (!context || !suggestion.accept(context)) {
            return;
        }

        const change = suggestion.getChange(context);
        this.applyChange(change, context);
        if (shouldSubmit && change.shouldSubmit) {
            this.submit();
        }
    },

    applyChange(change, { text, selection }) {
        this.get('inputView')
            .set('ghost', null)
            .set('value', change.apply(text))
            .set('selection', change.updateSelection(selection))
            .focus();
        return this;
    },

    submit() {},
});

// ---

export { AutoCompleteController };
