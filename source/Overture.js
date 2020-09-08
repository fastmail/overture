/* eslint-disable max-len */

export {
    meta,
    isDestroyed,
    guid,
    mixin,
    merge,
    clone,
    isEqual,
    Class,
} from './core/Core.js';
export { default as sortByProperties } from './core/sortByProperties.js';
import './core/Array.js';
import './core/Date.js';
import './core/Number.js';
import './core/Object.js';
import './core/RegExp.js';
import './core/String.js';

export { Binding, bind, bindTwoWay } from './foundation/Binding.js';
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
import * as RunLoop from './foundation/RunLoop.js';
export { RunLoop };
import * as Transform from './foundation/Transform.js';
export { Transform };
import Promise from './foundation/Promise.js';
// Replace the global Promise with our RunLoop-enabled Promise
window.Promise = Promise;
// … as well as as `O.Promise`.
export { Promise };

export { default as Color } from './color/Color.js';

export { default as AnimatableView } from './animation/AnimatableView.js';
export { default as Animation } from './animation/Animation.js';
export { default as Easing } from './animation/Easing.js';
export { default as StyleAnimation } from './animation/StyleAnimation.js';

import * as keyboardShortcuts from './application/keyboardShortcuts.js';
export { keyboardShortcuts };
export { default as formatKeyForPlatform } from './application/formatKeyForPlatform.js';
export { default as toPlatformKey } from './application/toPlatformKey.js';
export { default as GlobalKeyboardShortcuts } from './application/GlobalKeyboardShortcuts.js';
export { default as Router } from './application/Router.js';
export { default as ThemeManager } from './application/ThemeManager.js';
export { default as WindowController } from './application/WindowController.js';

export { default as RecordArray } from './datastore/query/RecordArray.js';
export { default as Query } from './datastore/query/Query.js';
export { default as LocalQuery } from './datastore/query/LocalQuery.js';
export { default as WindowedQuery } from './datastore/query/WindowedQuery.js';
export { default as AttributeErrors } from './datastore/record/AttributeErrors.js';
import Record from './datastore/record/Record.js';
export { Record };
import { attr, RecordAttribute } from './datastore/record/attr.js';
Record.attr = attr;
export { RecordAttribute };
import * as Status from './datastore/record/Status.js';
export { Status };
import { toMany, ToManyAttribute } from './datastore/record/toMany.js';
Record.toMany = toMany;
export { ToManyAttribute };
import { toOne, ToOneAttribute } from './datastore/record/toOne.js';
Record.toOne = toOne;
export { ToOneAttribute };
export { default as RecordResult } from './datastore/record/RecordResult.js';
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
import * as Element from './dom/Element.js';
export { Element };
import * as Stylesheet from './dom/Stylesheet.js';
export { Stylesheet };

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

export { default as Locale } from './localisation/Locale.js';
import * as i18n from './localisation/i18n.js';
export { i18n };
export { loc } from './localisation/i18n.js';
import './localisation/RelativeDate.js';

import * as parse from './parser/DateParser.js';
export { parse };
import Parse, {
    define,
    optional,
    not,
    repeat,
    sequence,
    firstMatch,
    longestMatch,
} from './parser/Parse.js';
Object.assign(Parse, {
    define,
    optional,
    not,
    repeat,
    sequence,
    firstMatch,
    longestMatch,
});
export { Parse };

export { default as OptionsController } from './selection/OptionsController.js';
export { default as SelectionController } from './selection/SelectionController.js';
export { default as SingleSelectionController } from './selection/SingleSelectionController.js';

export { default as LocalStorage } from './storage/LocalStorage.js';

export { default as TimeZone } from './timezones/TimeZone.js';

export { default as Gesture } from './touch/Gesture.js';
export { default as GestureManager } from './touch/GestureManager.js';
export { default as Hold } from './touch/Hold.js';
export { default as Tap } from './touch/Tap.js';

import * as UA from './ua/UA.js';
export { UA };

export { default as RootView } from './views/RootView.js';
export { default as View } from './views/View.js';
export {
    default as activeViews,
    getViewFromNode,
} from './views/activeViews.js';
export { default as ViewEventsController } from './views/ViewEventsController.js';
export { default as ListItemView } from './views/collections/ListItemView.js';
export { default as ListKBFocusView } from './views/collections/ListKBFocusView.js';
export { default as ListView } from './views/collections/ListView.js';
export { default as ProgressiveListView } from './views/collections/ProgressiveListView.js';
export { default as OptionsListView } from './views/collections/OptionsListView.js';
export {
    default as SwitchView,
    when,
    unless,
    choose,
} from './views/collections/SwitchView.js';
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
export { default as KeyDownController } from './views/controls/KeyDownController.js';
export {
    ShortcutView,
    ShortcutOverlayView,
} from './views/controls/ShortcutOverlayView.js';
export { default as MenuOptionView } from './views/menu/MenuOptionView.js';
export { default as MenuFilterView } from './views/menu/MenuFilterView.js';
export { default as MenuButtonView } from './views/menu/MenuButtonView.js';
export { default as MenuView } from './views/menu/MenuView.js';
export { default as RadioView } from './views/controls/RadioView.js';
export { default as RichTextView } from './views/controls/RichTextView.js';
export { default as SearchTextView } from './views/controls/SearchTextView.js';
export { default as SelectView } from './views/controls/SelectView.js';
export { default as TextView } from './views/controls/TextView.js';
export { default as ModalEventHandler } from './views/panels/ModalEventHandler.js';
export { default as PopOverView } from './views/panels/PopOverView.js';
