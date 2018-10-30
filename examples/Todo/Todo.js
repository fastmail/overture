/*  Todo – OvertureJS Example App

    © 2014 FastMail Pty Ltd. MIT Licensed.

    General styling and background image from TodoMVC – http://todomvc.com

    The classic example of every JS framework, the Todo demo app makes use of
    a large part of the Overture library to show off some of the features. I
    (perhaps somewhat ambitiously) decided to see how complete a Todo app I
    could create in one day, and this is the current result. It has drag/drop
    reorder, full keyboard shortcuts, live search and undo/redo. I didn't have
    time to do start dates, multiple lists and smart views, but there's support
    for most of this in the model already and when I find a few spare hours
    I'll update this demo app to showcase a few more library features.

    – Neil Jenkins (2014-12-19)

    2018-10-25 onwards: Chris Morgan, Ricardo Signes and Michael McClimon are
    playing around with adding more functionality to this. Somewhere along the
    way, Chris Morgan turned it into ES6 modules, because it was getting a bit
    out of hand. That does make it a bit harder to keep track of everything,
    sadly.
*/

/* global O */

import state from './state.js';
import { appView, todoListsView } from './views/poorlyNamedModule.js';
import mainWindow from './views/root.js';

const {
    Element: { when },
    RunLoop,
} = O;

// --- Views ---

/* Insert the view we've constructed into the document */
mainWindow.insertView(
    when( state, 'listId' ).show([
        appView,
    ]).otherwise([
        todoListsView,
    ]).end()
);

/*  Because this setup code is not being run inside a run loop, we now need to
    flush all queues. Other than this, the queues will be managed completely
    automatically. A better option would be to wrap all of this setup code in

        O.RunLoop.invoke( function () {
            var App = {};
            ...
        });
    This will also mean you don't create any global variables. For demo purposes
    though, it's better to be able to inspect everything easily in the JS
    console.

    [With the ES6 module translation, the globals argument no longer applies,
    and O.RunLoop.invoke() wrapping on *all* the code is not possible.]
*/
RunLoop.flushAllQueues();
