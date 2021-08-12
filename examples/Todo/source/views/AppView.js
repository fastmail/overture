import { Class } from 'overture/core';
import { el } from 'overture/dom';
import { bind, bindTwoWay, invert } from 'overture/foundation';
import { ButtonView, TextView, ListView, SearchTextView, ToolbarView, View } from 'overture/views';

import { actions, state, undoManager } from '../app';
import { TodoView } from './TodoView.js';

const AppView = new Class({
    Name: 'AppView',
    Extends: View,
    className: 'v-App',
    draw() {
        return [
            new TextView({
                positioning: 'absolute',
                className: 'v-App-title',
                value: 'Todo'
            }),
            new ToolbarView({
                left: [
                    new ButtonView({
                        icon: 'icon-plus-circle',
                        isDisabled: bind( state, 'isLoadingList' ),
                        label: 'New Todo',
                        shortcut: 'Enter',
                        target: actions,
                        method: 'create'
                    }),
                    new ButtonView({
                        icon: 'icon-rotate-left',
                        layout: { marginLeft: 10 },
                        isDisabled: bind( undoManager, 'canUndo',
                            invert ),
                        label: 'Undo',
                        /* Can define a keyboard shortcut directly on the button
                           it is equivalent to. The shortcut will be active so long
                           as the button is in the document. */
                        shortcut: 'Cmd-z',
                        target: undoManager,
                        method: 'undo'
                    })
                ],
                right: [
                    new SearchTextView({
                        icon: el( 'i', {
                            className: 'icon icon-search'
                        }),
                        layout: { width: 200 },
                        placeholder: 'Search',
                        shortcut: '/',
                        value: bindTwoWay( state, 'search' )
                    })
                ]
            }),
            new View({
                className: 'v-TodoList',
                draw (/* layer */) {
                    return [
                        new ListView({
                            content: bind( state, 'todos' ),
                            ItemView: TodoView,
                            itemHeight: 48
                        })
                    ];
                }
            }),
        ]
    },
    newTodo: function ( event ) {
        if ( event.targetView === this ) {
            actions.create();
        }
    }.on( 'dblclick' )
});

export { AppView };
