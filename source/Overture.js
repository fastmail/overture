/* eslint-disable max-len */

/*
    NOTE(circular-imports): there are several circular imports in the Overture
    codebase still. Provided the circular references don’t get hit immediately
    (that is, provided the circularly-referenced names are only used inside
    functions which are not invoked until after all of the loop has been
    loaded), this is very mildly undesirable, but OK. (Such imports should be
    marked by a comment as circular but OK.)

    HOWEVER, in places where the name is used in the code executed immediately
    (e.g. as a superclass for a class constructed in the module root), we have a
    problem. The referred-to name must *not* be imported first: something else
    from the circular import loop must be instead. For now, we can work around
    this by ordering our imports carefully in this file, but it’s not good
    enough; we desire to be able to import anything from Overture directly, thus
    enabling further dead-code removal.

    To list circular imports, install madge (from npm) and run this command:

        madge source/Overture --circular

    If it does not list exactly the five below, we’re in trouble and you’ll have
    to assess it all over again.

    Safe cycles that exist:

    - drag-drop/{Drag ↔ DragController}: not used in the global scope

    - dom/Element ↔ views/View: not used in the global scope

    Bad cycles that exist and are dependent on import order (marked elsewhere in
    this file by FIXME notes):

    - core/Date → localisation/LocaleController → localisation/Locale →
      core/Date: LocaleController uses Locale in the global scope
*/

export { meta, guid, mixin, extend, merge, clone, isEqual, Class } from './core/Core';
export { default as sortByProperties } from './core/sortByProperties';
import './core/Array';
import './core/Date';
import './core/Number';
import './core/Object';
import './core/RegExp';
import './core/String';

export { Binding, bind, bindTwoWay } from './foundation/Binding';
export { default as BoundProps } from './foundation/BoundProps';
export { default as ComputedProps } from './foundation/ComputedProps';
export { default as Enumerable } from './foundation/Enumerable';
export { default as Event } from './foundation/Event';
export { default as EventTarget } from './foundation/EventTarget';
export { default as getFromPath } from './foundation/getFromPath';
export { default as Heap } from './foundation/Heap';
export { default as MutableEnumerable } from './foundation/MutableEnumerable';
export { default as Object } from './foundation/Object';
export { default as ObservableArray } from './foundation/ObservableArray';
export { default as ObservableProps } from './foundation/ObservableProps';
export { default as ObservableRange } from './foundation/ObservableRange';
export { default as RunLoop } from './foundation/RunLoop';
import * as Transform from './foundation/Transform';
export { Transform };
import Promise from './foundation/Promise';
// Replace the global Promise with our RunLoop-enabled Promise
self.Promise = Promise;
// … as well as as `O.Promise`.
export { Promise };

export { default as AnimatableView } from './animation/AnimatableView';
export { default as Animation } from './animation/Animation';
export { default as Easing } from './animation/Easing';
export { default as StyleAnimation } from './animation/StyleAnimation';

export { default as formatKeyForPlatform } from './application/formatKeyForPlatform';
export { default as GlobalKeyboardShortcuts } from './application/GlobalKeyboardShortcuts';
export { default as Router } from './application/Router';
export { default as ThemeManager } from './application/ThemeManager';
export { default as WindowController } from './application/WindowController';

export { default as RecordArray } from './datastore/query/RecordArray';
export { default as Query } from './datastore/query/Query';
export { default as LocalQuery } from './datastore/query/LocalQuery';
export { default as WindowedQuery } from './datastore/query/WindowedQuery';
export { default as AttributeErrors } from './datastore/record/AttributeErrors';
import { default as Record, attr, toOne } from './datastore/record/Record';
Record.attr = attr;
Record.toOne = toOne;
export { Record };
export { default as RecordAttribute } from './datastore/record/RecordAttribute';
import * as Status from './datastore/record/Status';
export { Status };
export { default as ToManyAttribute } from './datastore/record/ToManyAttribute';
export { default as ToOneAttribute } from './datastore/record/ToOneAttribute';
export { default as RecordResult } from './datastore/record/RecordResult';
export { default as ValidationError } from './datastore/record/ValidationError';
export { default as AggregateSource } from './datastore/source/AggregateSource';
export { default as Source } from './datastore/source/Source';
export { default as MemoryManager } from './datastore/store/MemoryManager';
export { default as NestedStore } from './datastore/store/NestedStore';
export { default as Store } from './datastore/store/Store';
export { default as StoreUndoManager } from './datastore/store/StoreUndoManager';
export { default as UndoManager } from './datastore/store/UndoManager';

import * as DOMEvent from './dom/DOMEvent';
export { DOMEvent };
// Alas, Element should be purely a namespace, but View#draw depends on it being
// an object. Note that importing SwitchView later modifies it. Ick, huh? So
// `import * as Element from './dom/Element';` actually gets you a tangibly
// different result from `import Element from './dom/Element';` in that the
// latter lacks <O.Element#when> and <O.Element#unless>. Yep, very ick. Sorry.
export { default as Element } from './dom/Element';
import * as Stylesheet from './dom/Stylesheet';
export { Stylesheet };

export { default as Drag } from './drag-drop/Drag';
export { default as DragController } from './drag-drop/DragController';
export { default as DragDataSource } from './drag-drop/DragDataSource';
import * as DragEffect from './drag-drop/DragEffect';
export { DragEffect };
export { default as Draggable } from './drag-drop/Draggable';
export { default as DropTarget } from './drag-drop/DropTarget';

export { default as EventSource } from './io/EventSource';
export { default as HttpRequest } from './io/HttpRequest';
export { default as IOQueue } from './io/IOQueue';
export { default as XHR } from './io/XHR';

// FIXME(circular-imports): core/Date → localisation/LocaleController →
// localisation/Locale → core/Date, but LocaleController uses Locale
// immediately, so Locale must not be the first one imported. For now, core/Date
// is imported first and the crisis averted. Chris’s proposal to resolve this:
//
// 1. Do *something* with localisation/RelativeDate.js
//    (which is all side-effects on the global Date object, ick);
// 2. Merge localisation/{Locale, LocaleController}.js to just i18n.js;
// 3. Abolish the LocaleController export for good measure (O.i18n is nice,
//    singletons with a capital first letter aren’t).
export { default as Locale } from './localisation/Locale';
export { LocaleController, i18n, loc } from './localisation/LocaleController';
import './localisation/RelativeDate';

export { default as parse } from './parser/DateParser';
export { default as Parse } from './parser/Parse';

export { default as OptionsController } from './selection/OptionsController';
export { default as SelectionController } from './selection/SelectionController';
export { default as SingleSelectionController } from './selection/SingleSelectionController';

export { default as LocalStorage } from './storage/LocalStorage';

export { default as TimeZone } from './timezones/TimeZone';

export { default as Gesture } from './touch/Gesture';
export { default as GestureManager } from './touch/GestureManager';
export { default as Hold } from './touch/Hold';
export { default as Tap } from './touch/Tap';

export { default as UA } from './ua/UA';

export { default as RootView } from './views/RootView';
export { default as View } from './views/View';
export { default as activeViews, getViewFromNode } from './views/activeViews';
export { default as ViewEventsController } from './views/ViewEventsController';
export { default as ListItemView } from './views/collections/ListItemView';
export { default as ListKBFocusView } from './views/collections/ListKBFocusView';
export { default as ListView } from './views/collections/ListView';
export { default as ProgressiveListView } from './views/collections/ProgressiveListView';
export { default as OptionsListView } from './views/collections/OptionsListView';
export { default as SwitchView } from './views/collections/SwitchView';
export { default as ToolbarView } from './views/collections/ToolbarView';
export { default as TrueVisibleRect } from './views/collections/TrueVisibleRect';
export { default as ScrollView } from './views/containers/ScrollView';
export { default as SplitDividerView } from './views/containers/SplitDividerView';
export { default as SplitViewController } from './views/containers/SplitViewController';
export { default as AbstractControlView } from './views/controls/AbstractControlView';
export { default as ButtonView } from './views/controls/ButtonView';
export { default as CheckboxView } from './views/controls/CheckboxView';
export { default as ClearSearchButtonView } from './views/controls/ClearSearchButtonView';
export { default as FileButtonView } from './views/controls/FileButtonView';
export { default as LabelView } from './views/controls/LabelView';
export { default as MenuOptionView } from './views/menu/MenuOptionView';
export { default as MenuFilterView } from './views/menu/MenuFilterView';
export { default as MenuButtonView } from './views/menu/MenuButtonView';
export { default as MenuView } from './views/menu/MenuView';
export { default as RadioView } from './views/controls/RadioView';
export { default as RichTextView } from './views/controls/RichTextView';
export { default as SearchTextView } from './views/controls/SearchTextView';
export { default as SelectView } from './views/controls/SelectView';
export { default as TextView } from './views/controls/TextView';
export { default as ModalEventHandler } from './views/panels/ModalEventHandler';
export { default as PopOverView } from './views/panels/PopOverView';
