/*  Todo – OvertureJS Example App

    © 2014 Fastmail Pty Ltd. MIT Licensed.

    General styling and background image from TodoMVC – http://todomvc.com

    The classic example of every JS framework, the Todo demo app makes use of
    a large part of the Overture library to show off some of the features. I
    (perhaps somewhat ambitiously) decided to see how complete a Todo app I
    could create in one day, and this is the current result. It has drag/drop
    reorder, full keyboard shortcuts, live search and undo/redo. I didn't have
    time to do start dates, multiple lists and smart views, but there's support
    for most of this in the model already and when I find a few spare hours
    I'll update this demo app to showcase a few more library features.

    – Neil Jenkins (2014-12-19)
*/
import '/overture/Global';
import { classes } from '/overture/core';
import { el } from '/overture/dom';
import { flushAllQueues } from '/overture/foundation';
import {
    ButtonView,
    ClearSearchButtonView,
    KeyDownController,
    RootView,
    ShortcutOverlayView,
    when,
    getViewFromNode,
} from '/overture/views';

import './fixtures';
import './locale';
import { keyboardShortcuts, selectedTodo, state } from './app';
import { AppView } from './views';

/*globals document, window */

// ---

// ---

// --- Views ---

/* A RootView instance is required for each browser window under the control of
   your app
*/
const rootView = new RootView(document, {
    selectNone: function (event) {
        if (!(event.targetView instanceof ButtonView)) {
            state.set('editTodo', null);
            selectedTodo.set('record', null);
        }
    }.on('click'),
});

ClearSearchButtonView.prototype.icon = el('i', {
    className: 'icon icon-clear',
});

const appView = new AppView();

/* Insert the view we've constructred into the document */
rootView.insertView(appView);

/* Create and insert the shortcut overlay */
const shortcutOverlayController = new KeyDownController({
    delay: 400,
});

const shortcutOverlayView = when(shortcutOverlayController, 'isKeyDown')
    .show([new ShortcutOverlayView({ shortcuts: keyboardShortcuts })])
    .end();

rootView.insertView(shortcutOverlayView);

/*  Because this setup code is not being run inside a run loop, we now need to
    flush all queues. Other than this, the queues will be managed completely
    automatically. A better option would be to wrap all of this setup code in

        RunLoop.invoke( function () {
            var App = {};
            ...
        });
    This will also mean you don't create any global variables. For demo purposes
    though, it's better to be able to inspect everything easily in the JS
    console.
*/
flushAllQueues();

window.FM = {
    classes,
    getViewFromNode,
};
