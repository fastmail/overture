import state from '../state.js';
import { actions } from '../actions.js';
import { editStore, undoManager } from '../models.js';
import TodoItemView from './TodoItemView.js';

const {
    bind,
    bindTwoWay,
    ButtonView,
    ClearSearchButtonView,
    Element: { create: el },
    ListView,
    SearchTextView,
    TextView,
    ToolbarView,
    Transform: { invert },
    DOMEvent: { lookupKey },
    View,
} = O;

ClearSearchButtonView.prototype.icon = 'icon-clear';

const appView = new View({
    className: 'v-App',
    draw: function ( layer, Element, el ) {
        return [
            Element.when( this, 'isEditing' ).show([
                el( 'div.v-App-title.is-editing', [
                    new TextView({
                        value: bindTwoWay( state, 'list.name' ),
                        autoFocus: function () {
                            if ( this.get( 'isInDocument' ) ) {
                                this.focus();
                            }
                        }.observes( 'isInDocument' )
                    })
                ]),
            ]).otherwise([
                this._name = el( 'div.v-App-title', {
                    text: bind( state, 'list.name' )
                })
            ]).end(),

            new ToolbarView({
                left: [
                    new ButtonView({
                        icon: 'icon-plus-circle',
                        isDisabled: bind( state, 'isLoadingList' ),
                        label: 'New Todo',
                        shortcut: 'Enter',
                        target: actions,
                        method: 'newTodo'
                    }),
                    new ButtonView({
                        icon: 'icon-rotate-left',
                        layout: { marginLeft: 10 },
                        isDisabled: bind( undoManager, 'canUndo', invert ),
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
                draw: function (/* layer, Element, el */) {
                    return [
                        new ListView({
                            content: bind( state, 'todos' ),
                            ItemView: TodoItemView,
                            itemHeight: 48
                        })
                    ];
                }
            })
        ];
    },

    stopEditing: function ( event ) {
        if ( this.get( 'isEditing' ) ) {
            var key = lookupKey( event );
            if ( key === 'Enter' || key === 'Escape' ) {
                this.set( 'isEditing', false );
                editStore.commitChanges();
                event.stopPropagation();
            }
        }
    }.on( 'keydown' ),

    newTodo: function ( event ) {
        if ( event.target === this._name ) {
            this.set( 'isEditing', true );
        } else if ( event.targetView === this ) {
            actions.newTodo();
        }
    }.on( 'dblclick' )
});

const todoListsView = new View({
    className: 'v-App',
    draw: function ( layer, Element, el ) {
        return [
            el('div.v-App-title', [ 'blah' ]),
            new ToolbarView({
                left: [
                    new ButtonView({
                        icon: 'icon-plus-circle',
                        isDisabled: bind( state, 'isLoadingList' ),
                        label: 'New Todo List',
                        shortcut: 'Enter',
                        target: actions,
                        method: 'newTodoList'
                    }),
                    new ButtonView({
                        icon: 'icon-rotate-left',
                        layout: { marginLeft: 10 },
                        isDisabled: bind( undoManager, 'canUndo', invert ),
                        label: 'Undo',
                        /* Can define a keyboard shortcut directly on the button
                           it is equivalent to. The shortcut will be active so long
                           as the button is in the document. */
                        shortcut: 'Cmd-z',
                        target: undoManager,
                        method: 'undo'
                    })
                ],
            }),
            new View({
                className: 'v-TodoList',
                draw: function (/* layer, Element, el */) {
                    return [
                        'TODO'
                        /*new ListView({
                            content: bind( state, 'todoLists' ),
                            ItemView: TodoListView,
                            itemHeight: 48
                        })*/
                    ];
                }
            })
        ];
    },

    stopEditing: function ( event ) {
        if ( this.get( 'isEditing' ) ) {
            var key = lookupKey( event );
            if ( key === 'Enter' || key === 'Escape' ) {
                this.set( 'isEditing', false );
                editStore.commitChanges();
                event.stopPropagation();
            }
        }
    }.on( 'keydown' ),

    newTodoList: function ( event ) {
        if ( event.targetView === this ) {
            actions.newTodoList();
        }
    }.on( 'dblclick' )
});

export {
    appView,
    todoListsView,
};
