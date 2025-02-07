import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { loc } from '../../localisation/i18n.js';
import { canPointer } from '../../ua/UA.js';
import { ScrollView } from '../containers/ScrollView.js';
import { ButtonView } from '../controls/ButtonView.js';
import { View } from '../View.js';

// ---

const moveEvent = canPointer ? 'pointermove' : 'mousemove';
const leaveEvent = canPointer ? 'pointerleave' : 'mouseleave';

// ---

const AutoCompleteOptionView = Class({
    Name: 'AutoCompleteOptionView',

    Extends: View,

    init: function () {
        this._focusFromPointer = false;
        this.isFocused = false;
        AutoCompleteOptionView.parent.init.apply(this, arguments);
    },

    layerTag: 'li',

    className: function () {
        return (
            'v-AutoCompleteOption' +
            (this.get('isFocused') ? ' is-focused' : '')
        );
    }.property('isFocused'),

    layout: function () {
        const listView = this.get('parentView');
        return {
            height: listView.get('itemHeight'),
        };
    }.property(),

    drawIcon(suggestion, context) {
        return suggestion.drawIcon(context);
    },

    drawContent(suggestion, context) {
        const description = suggestion.drawDescription(context);
        return [
            el('span.u-trim.u-min-w-0', [
                el('span.u-truncate', [suggestion.drawLabel(context)]),
            ]),
            description
                ? el('span.u-trim.u-min-w-0.u-text-sm.u-color-unimportant', [
                      el('span.u-truncate', [description]),
                  ])
                : null,
        ];
    },

    drawHelpText(suggestion, context) {
        const helpText = suggestion.drawHelpText(context);
        return helpText
            ? el('span.u-trim.u-text-sm.u-color-unimportant', [helpText])
            : null;
    },

    drawRemove(suggestion /*, context*/) {
        return new ButtonView({
            label: loc('Remove'),
            target: suggestion,
            method: 'remove',
        });
    },

    draw(/* layer */) {
        const context = this.get('controller');
        const suggestion = this.get('content');
        return el('div.v-AutoCompleteOption-contents', [
            el('span.u-flex-1.u-flex.u-items-center.u-space-x-3_5', [
                suggestion.drawIcon(context),
                el(
                    'span.u-flex.u-flex-col.u-space-y-2.u-min-w-0.u-pointer-events-none',
                    this.drawContent(suggestion, context),
                ),
                el('div.u-flex-1', {
                    style: 'margin-left: 0',
                }),
                this.drawHelpText(suggestion, context),
                suggestion.isRemovable(context)
                    ? this.drawRemove(suggestion, context)
                    : null,
            ]),
        ]);
    },

    // ---

    isInDocumentDidChange: function () {
        const layer = this.get('layer');
        if (this.get('isInDocument')) {
            layer.addEventListener(moveEvent, this, false);
            layer.addEventListener(leaveEvent, this, false);
        } else {
            layer.removeEventListener(leaveEvent, this, false);
            layer.removeEventListener(moveEvent, this, false);
        }
    }.observes('isInDocument'),

    takeFocus: function () {
        this._focusFromPointer = true;
        this.set('isFocused', true);
        this._focusFromPointer = false;
        this.get('focused').set('record', this.get('content'));
    }.on(moveEvent, 'touchstart'),

    releaseFocus: function () {
        if (this.get('isFocused')) {
            this.get('focused').set('record', null);
        }
    }.on(leaveEvent, 'touchend'),

    click: function (event) {
        if (event.targetView !== this) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const context = this.get('controller');
        context.controller.select(this.get('content'), true);
    }.on('click'),

    isFocusedDidChange: function () {
        if (this.get('isFocused') && !this._focusFromPointer) {
            this.scrollIntoView();
        }
    }.observes('isFocused'),

    scrollIntoView: function () {
        const scrollView = this.getParent(ScrollView);
        if (!scrollView || !this.get('isInDocument')) {
            return;
        }
        const top = this.getPositionRelativeTo(scrollView).top;
        const height = this.get('pxHeight');
        const scrollTop = scrollView.get('scrollTop');
        const scrollHeight = scrollView.get('pxHeight');

        if (top < scrollTop) {
            scrollView.scrollTo(0, top - (height >> 1), true);
        } else if (top + height > scrollTop + scrollHeight) {
            scrollView.scrollTo(
                0,
                top + height - scrollHeight + (height >> 1),
                true,
            );
        }
    }.queue('after'),
});

const ProgressiveAutocompleteOptionView = Class({
    Name: 'ProgressiveAutocompleteOptionView',

    Extends: AutoCompleteOptionView,

    positioning: 'absolute',

    layout: function () {
        const listView = this.get('parentView');
        const top = listView.indexToOffset(this.get('index'));
        return {
            top,
            height: listView.get('itemHeight'),
        };
    }.property('index'),
});

// ---

export { AutoCompleteOptionView, ProgressiveAutocompleteOptionView };
