/* eslint-disable max-len */

export {
    meta,
    isDestroyed,
    guid,
    mixin,
    extend,
    merge,
    clone,
    isEqual,
    Class,
} from './core/Core';
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
import * as RunLoop from './foundation/RunLoop';
export { RunLoop };
import * as Transform from './foundation/Transform';
export { Transform };
import Promise from './foundation/Promise';
// Replace the global Promise with our RunLoop-enabled Promise
self.Promise = Promise;
// … as well as as `O.Promise`.
export { Promise };

export { default as Color } from './color/Color.js';

export { default as AnimatableView } from './animation/AnimatableView';
export { default as Animation } from './animation/Animation';
export { default as Easing } from './animation/Easing';
export { default as StyleAnimation } from './animation/StyleAnimation';

import * as keyboardShortcuts from './application/keyboardShortcuts';
export { keyboardShortcuts };
export { default as formatKeyForPlatform } from './application/formatKeyForPlatform';
export { default as toPlatformKey } from './application/toPlatformKey';
export { default as GlobalKeyboardShortcuts } from './application/GlobalKeyboardShortcuts';
export { default as Router } from './application/Router';
export { default as ThemeManager } from './application/ThemeManager';
export { default as WindowController } from './application/WindowController';

export { default as RecordArray } from './datastore/query/RecordArray';
export { default as Query } from './datastore/query/Query';
export { default as LocalQuery } from './datastore/query/LocalQuery';
export { default as WindowedQuery } from './datastore/query/WindowedQuery';
export { default as AttributeErrors } from './datastore/record/AttributeErrors';
import Record from './datastore/record/Record';
export { Record };
import { attr, RecordAttribute } from './datastore/record/attr';
Record.attr = attr;
export { RecordAttribute };
import * as Status from './datastore/record/Status';
export { Status };
import { toMany, ToManyAttribute } from './datastore/record/toMany';
Record.toMany = toMany;
export { ToManyAttribute };
import { toOne, ToOneAttribute } from './datastore/record/toOne';
Record.toOne = toOne;
export { ToOneAttribute };
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
import * as Element from './dom/Element';
export { Element };
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

export { default as Locale } from './localisation/Locale';
import * as i18n from './localisation/i18n';
export { i18n };
export { loc } from './localisation/i18n';
import './localisation/RelativeDate';

import * as parse from './parser/DateParser';
export { parse };
import Parse, {
    define,
    optional,
    not,
    repeat,
    sequence,
    firstMatch,
    longestMatch,
} from './parser/Parse';
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

export { default as OptionsController } from './selection/OptionsController';
export { default as SelectionController } from './selection/SelectionController';
export { default as SingleSelectionController } from './selection/SingleSelectionController';

export { default as LocalStorage } from './storage/LocalStorage';

export { default as TimeZone } from './timezones/TimeZone';

export { default as Gesture } from './touch/Gesture';
export { default as GestureManager } from './touch/GestureManager';
export { default as Hold } from './touch/Hold';
export { default as Tap } from './touch/Tap';

import * as UA from './ua/UA';
export { UA };

export { default as RootView } from './views/RootView';
export { default as View } from './views/View';
export { default as activeViews, getViewFromNode } from './views/activeViews';
export { default as ViewEventsController } from './views/ViewEventsController';
export { default as ListItemView } from './views/collections/ListItemView';
export { default as ListKBFocusView } from './views/collections/ListKBFocusView';
export { default as ListView } from './views/collections/ListView';
export { default as ProgressiveListView } from './views/collections/ProgressiveListView';
export { default as OptionsListView } from './views/collections/OptionsListView';
export {
    default as SwitchView,
    when,
    unless,
    choose,
} from './views/collections/SwitchView';
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
export { default as KeyDownController } from './views/controls/KeyDownController';
export {
    ShortcutView,
    ShortcutOverlayView,
} from './views/controls/ShortcutOverlayView';
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
