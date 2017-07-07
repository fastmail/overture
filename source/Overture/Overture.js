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

    - views/controls/{MenuButtonView → MenuOptionView → MenuView →
      MenuController → MenuButtonView}: not used in the global scope

    Bad cycles that exist and are dependent on import order (marked elsewhere in
    this file by FIXME notes):

    - core/Date → localisation/LocaleController → localisation/Locale →
      core/Date: LocaleController uses Locale in the global scope

    - views/controls/{MenuOptionView ↔ MenuView}:
      MenuView uses MenuOptionView in the global scope
*/

export * from './core/Core.js';
export { default as sortByProperties } from './core/sortByProperties.js';
import './core/Array.js';
import './core/Date.js';
import './core/Number.js';
import './core/Object.js';
import './core/RegExp.js';
import './core/String.js';

export * from './foundation/Binding.js';
export { default as BoundProps } from './foundation/BoundProps.js';
export { default as ComputedProps } from './foundation/ComputedProps.js';
export { default as Enumerable } from './foundation/Enumerable.js';
export { default as Event } from './foundation/Event.js';
export { default as EventTarget } from './foundation/EventTarget.js';
export { default as getFromPath } from './foundation/getFromPath.js';
export { default as Heap } from './foundation/Heap.js';
export { default as MutableEnumerable } from './foundation/MutableEnumerable.js';
export { default as Object } from './foundation/Object.js';
export { default as ObservableArray } from './foundation/ObservableArray.js';
export { default as ObservableProps } from './foundation/ObservableProps.js';
export { default as ObservableRange } from './foundation/ObservableRange.js';
export { default as RunLoop } from './foundation/RunLoop.js';
export { default as Transform } from './foundation/Transform.js';

export { default as AnimatableView } from './animation/AnimatableView.js';
export { default as Animation } from './animation/Animation.js';
export { default as CSSStyleAnimation } from './animation/CSSStyleAnimation.js';
export { default as CSSStyleAnimationController } from './animation/CSSStyleAnimationController.js';
export { default as Easing } from './animation/Easing.js';
export { default as StyleAnimation } from './animation/StyleAnimation.js';

// FIXME(circular-imports): MenuView ↔ MenuOptionView, but MenuView uses
// MenuOptionView immediately so MenuView must be imported before MenuOptionView
// which is indirectly imported by GlobalKeyboardShortcuts, so this import must
// appear before GlobalKeyboardShortcuts in this list.
export { default as MenuView } from './views/controls/MenuView.js';

export { default as formatKeyForPlatform } from './application/formatKeyForPlatform.js';
export { default as GlobalKeyboardShortcuts } from './application/GlobalKeyboardShortcuts.js';
export { default as Router } from './application/Router.js';
export { default as ThemeManager } from './application/ThemeManager.js';
export { default as WindowController } from './application/WindowController.js';

export { default as LiveQuery } from './datastore/query/LiveQuery.js';
export { default as RecordArray } from './datastore/query/RecordArray.js';
export { default as RemoteQuery } from './datastore/query/RemoteQuery.js';
export { default as WindowedRemoteQuery } from './datastore/query/WindowedRemoteQuery.js';
export { default as AttributeErrors } from './datastore/record/AttributeErrors.js';
export { default as Record } from './datastore/record/Record.js';
export { default as RecordAttribute } from './datastore/record/RecordAttribute.js';
import * as Status from './datastore/record/Status.js';
export { Status };
export { default as ToManyAttribute } from './datastore/record/ToManyAttribute.js';
export { default as ToOneAttribute } from './datastore/record/ToOneAttribute.js';
export { default as ValidationError } from './datastore/record/ValidationError.js';
export { default as AggregateSource } from './datastore/source/AggregateSource.js';
export { default as Source } from './datastore/source/Source.js';
export { default as MemoryManager } from './datastore/store/MemoryManager.js';
export { default as NestedStore } from './datastore/store/NestedStore.js';
export { default as Store } from './datastore/store/Store.js';
export { default as StoreUndoManager } from './datastore/store/StoreUndoManager.js';
export { default as UndoManager } from './datastore/store/UndoManager.js';

import * as DOMEvent from './dom/DOMEvent.js';
export { DOMEvent };
export { default as Element } from './dom/Element.js';
export { default as Stylesheet } from './dom/Stylesheet.js';

export { default as Drag } from './drag-drop/Drag.js';
export { default as DragController } from './drag-drop/DragController.js';
export { default as DragDataSource } from './drag-drop/DragDataSource.js';
import * as DragEffect from './drag-drop/DragEffect.js';
export { DragEffect };
export { default as Draggable } from './drag-drop/Draggable.js';
export { default as DropTarget } from './drag-drop/DropTarget.js';

export { default as EventSource } from './io/EventSource.js';
export { default as HttpRequest } from './io/HttpRequest.js';
export { default as IOQueue } from './io/IOQueue.js';
export { default as XHR } from './io/XHR.js';

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
export { default as Locale } from './localisation/Locale.js';
export * from './localisation/LocaleController.js';
import './localisation/RelativeDate.js';

export { default as parse } from './parser/DateParser.js';
export { default as Parse } from './parser/Parse.js';

export { default as SelectionController } from './selection/SelectionController.js';
export { default as SingleSelectionController } from './selection/SingleSelectionController.js';

export { default as LocalStorage } from './storage/LocalStorage.js';

export { default as TimeZone } from './timezones/TimeZone.js';

export { default as Gesture } from './touch/Gesture.js';
export { default as GestureManager } from './touch/GestureManager.js';
export { default as Hold } from './touch/Hold.js';
export { default as Tap } from './touch/Tap.js';

export { default as UA } from './ua/UA.js';

export { default as RootView } from './views/RootView.js';
export { default as View } from './views/View.js';
export { default as ViewEventsController } from './views/ViewEventsController.js';
export { default as ListItemView } from './views/collections/ListItemView.js';
export { default as ListKBFocusView } from './views/collections/ListKBFocusView.js';
export { default as ListView } from './views/collections/ListView.js';
export { default as ProgressiveListView } from './views/collections/ProgressiveListView.js';
export { default as SwitchView } from './views/collections/SwitchView.js';
export { default as ToolbarView } from './views/collections/ToolbarView.js';
export { default as TrueVisibleRect } from './views/collections/TrueVisibleRect.js';
export { default as ScrollView } from './views/containers/ScrollView.js';
export { default as SplitDividerView } from './views/containers/SplitDividerView.js';
export { default as SplitViewController } from './views/containers/SplitViewController.js';
export { default as AbstractControlView } from './views/controls/AbstractControlView.js';
export { default as ButtonView } from './views/controls/ButtonView.js';
export { default as CheckboxView } from './views/controls/CheckboxView.js';
export { default as ClearSearchButtonView } from './views/controls/ClearSearchButtonView.js';
export { default as FileButtonView } from './views/controls/FileButtonView.js';
export { default as LabelView } from './views/controls/LabelView.js';
export { default as MenuButtonView } from './views/controls/MenuButtonView.js';
export { default as MenuController } from './views/controls/MenuController.js';
export { default as MenuOptionView } from './views/controls/MenuOptionView.js';
export { default as RadioView } from './views/controls/RadioView.js';
export { default as RichTextView } from './views/controls/RichTextView.js';
export { default as SearchTextView } from './views/controls/SearchTextView.js';
export { default as SelectView } from './views/controls/SelectView.js';
export { default as TextView } from './views/controls/TextView.js';
export { default as ModalEventHandler } from './views/panels/ModalEventHandler.js';
export { default as PopOverView } from './views/panels/PopOverView.js';
