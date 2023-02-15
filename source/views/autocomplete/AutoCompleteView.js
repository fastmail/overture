import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { bind } from '../../foundation/Binding.js';
import { ObservableArray } from '../../foundation/ObservableArray.js';
import { loc } from '../../localisation/i18n.js';
import { canPointer } from '../../ua/UA.js';
import { ListView } from '../collections/ListView.js';
import { ProgressiveListView } from '../collections/ProgressiveListView.js';
import { TrueVisibleRect } from '../collections/TrueVisibleRect.js';
import { ScrollView } from '../containers/ScrollView.js';
import { ButtonView } from '../controls/ButtonView.js';
import { View } from '../View.js';
import {
    AutoCompleteOptionView,
    ProgressiveAutocompleteOptionView,
} from './AutoCompleteOptionView.js';

// ---

const moveEvent = canPointer ? 'pointermove' : 'mousemove';

const AutocompleteSourceView = Class({
    Name: 'AutocompleteSourceView',

    Extends: View,
    Mixin: TrueVisibleRect,

    className: 'v-AutoComplete-source',

    draw() {
        const context = this.get('context');
        const focused = this.get('focused');
        const source = this.get('source');
        const suggestions = this.get('suggestions');
        const name = source.get('name');
        const SuggestionListView =
            suggestions.length > 25 ? ProgressiveListView : ListView;
        const SuggestionOptionView =
            suggestions.length > 25
                ? ProgressiveAutocompleteOptionView
                : AutoCompleteOptionView;
        return [
            name
                ? el('div.v-AutoComplete-sourceName.u-flex.u-items-center', [
                      el('span.u-trim.u-color-unimportant', [name]),
                      source.isClearable(context)
                          ? [
                                el('span.u-flex-1'),
                                new ButtonView({
                                    type: 'v-Button--sizeS v-Button--subtle',
                                    label: loc('Clear all'),
                                    target: source,
                                    method: 'clear',
                                }),
                            ]
                          : null,
                  ])
                : null,
            new SuggestionListView({
                controller: context,
                className: 'v-AutoComplete-suggestions',
                focused,
                itemHeight: source.get('itemHeight'),
                ItemView: SuggestionOptionView,
                content: new ObservableArray(suggestions),
            }),
        ];
    },
});

const AutoCompleteView = Class({
    Name: 'AutoCompleteView',

    Extends: View,

    className: 'v-AutoComplete',

    layout: bind(null, 'controller*inputView.pxWidth', (pxWidth) => {
        return {
            width: pxWidth,
        };
    }),

    drawHeader(/*context*/) {
        return null;
    },

    drawSources(sources, focused, context) {
        return sources.map(({ source, suggestions }) => {
            return new AutocompleteSourceView({
                source,
                suggestions,
                focused,
                context,
            });
        });
    },

    draw() {
        const controller = this.get('controller');
        const context = controller.get('context');
        const focused = controller.get('focused');

        const { top, middle, bottom } = controller.get('suggestions');
        let header = this.drawHeader(context);
        if (header && !Array.isArray(header)) {
            header = [header];
        }
        return [
            header ? el('div.v-AutoComplete-header', header) : null,
            top ? this.drawSources(top, focused, context) : null,
            middle
                ? new ScrollView({
                      positioning: 'relative',
                      className: 'v-Scroll',
                      childViews: this.drawSources(middle, focused, context),
                  })
                : null,
            bottom ? this.drawSources(bottom, focused, context) : null,
        ];
    },

    suggestionsDidChange: function () {
        this.viewNeedsRedraw();
    }.observes('suggestions'),

    listen: function () {
        const layer = this.get('layer');
        if (this.get('isInDocument')) {
            layer.addEventListener(moveEvent, this, false);
            layer.addEventListener('mouseout', this, false);
        } else {
            layer.removeEventListener('mouseout', this, false);
            layer.removeEventListener(moveEvent, this, false);
        }
    }.observes('isInDocument'),

    mousedown: function (event) {
        event.preventDefault();
    }.on('mousedown'),
});

// ---

export { AutoCompleteView };
