/* global O */

import { actions } from '../actions.js';
import state from '../state.js';
import { editStore } from '../models.js';
import { selectedThing } from '../selection.js';

const {
    bind,
    bindTwoWay,
    Class,
    AnimatableView,
    Draggable,
    ListItemView,
    TextView,
    Element: { when },
    DOMEvent: { lookupKey },
} = O;

// ---

/* The TodoListItemView is used to render a Todo. The content property (set
   automatically by the ListView) is expected to be an instance of Todo.
*/
const TodoListItemView = Class({

    Extends: ListItemView,

    /* By mixing in O.AnimatableView, any changes to the "layout" property will
       automatically be animated. Mixing in O.Draggable allows a drag to be
       initiated on the view.
    */
    Mixin: [ AnimatableView, Draggable ],

    /* Turn off animation by default (it's just enabled while dragging)
       Also make the duration shorter than the default.
    */
    animateLayer: false,
    animateLayerDuration: 200,

    /* Inside a binding transform, `this` is the binding itself. We want to
       compare the object with Todo of this view, which can be found as the
       content property on the binding's toObject.
    */
    isEditing: bind( state, 'editTodoList', function ( editTodoList ) {
        return this.toObject.get( 'content' ) === editTodoList;
    }),

    isSelected: bind( selectedThing, 'record', function ( record ) {
        return this.toObject.get( 'content' ) === record;
    }),

    /* We define what the classname should be; Overture handles redrawing the
       DOM node to keep it in sync.
    */
    className: function () {
        return 'v-Todo' +
            ( this.get( 'isSelected' ) ? ' is-selected' : '' ) +
            ( this.get( 'isEditing' )  ? ' is-editing'  : '' );
    }.property( 'isSelected', 'isEditing' ),

    /* Position the view absolutely to make it easy to animate.
    */
    itemHeight: 48,

    /* When dragging, we'll set the layout manually from the drag handlers.
       Otherwise, the layout purely depends on how far down the list we are.
    */
    layout: function ( y ) {
        if ( y === undefined ) {
            y = ( this.get( 'index' ) * this.get( 'itemHeight' ) );
        }
        return {
            zIndex: this.get( 'isDragging' ) ? '1' : 'auto',
            transform: 'translate3d(0,' + y + 'px,0)',
        };
    }.property( 'isDragging' ),

    /* We would normally make index one of the computed property dependencies
       of layout, but because we don't want it to reset while dragging, we
       do it manually in this observer instead (automatically triggered
       whenever the index property chagnes).
    */
    invalidateLayout: function () {
        if ( !this.get( 'isDragging' ) ) {
            this.computedPropertyDidChange( 'layout' );
        }
    }.observes( 'index' ),

    /* Draw the view. Since it's such a common pattern, we can just return an
       array of children to be appended to the layer (the root node of the
       view).

       Note, we can append other view instances as well as DOM nodes.
    */
    draw ( layer, Element, el ) {
        const todoList = this.get( 'content' );
        return [
            /* Element.when is a shortcut for creating an O.SwitchView
               instance; essentially a live-updating if/else.
            */
            when( this, 'isEditing' ).show([
                el( 'div.v-Todo-summary', [
                    new TextView({
                        value: bindTwoWay( todoList, 'name' ),
                        autoFocus: function () {
                            if ( this.get( 'isInDocument' ) ) {
                                this.focus();
                            }
                        }.observes( 'isInDocument' ),
                    }),
                ]),
            ]).otherwise([
                el( 'div.v-Todo-summary', {
                    /* You can bind directly to DOM properties (text is a
                       special case to save you having to write textContent
                       every time)
                    */
                    text: bind( todoList, 'name' ),
                }),
            ]).end(),

        ];
    },

    /* This method will trigger whenever you click on the View (or any of its
       child elements/views). Events are handled via delegation, and actual
       setup of the handler is done on class definition, so there is zero
       overhead when instantiating instances of TodoListItemView.
    */
    select: function ( event ) {
        if ( !this.get( 'isSelected' ) ) {
            state.set( 'editTodoList', null );
            selectedThing.set( 'record', this.get( 'content' ) );
        } else if ( !this.get( 'isEditing' ) ) {
            actions.edit();
        }
        /* Stop propagation so the click handler on the root view isn't
           triggered.
        */
        event.stopPropagation();
    }.on( 'click' ),

    open: function ( event ) {
        this.stopEditing();
        state.set( 'listId', this.getFromPath( 'content.id' ) );

        event.stopPropagation();
    }.on( 'dblclick' ),

    stopEditing: function ( event ) {
        if ( this.get( 'isEditing' ) ) {
            const key = lookupKey( event );
            if ( key === 'Enter' || key === 'Escape' ) {
                state.set( 'editTodoList', null );
                event.stopPropagation();
            }
        }
    }.on( 'keydown' ),

    /* Handle dragging. When the user first starts to drag the view, this
       method is called. We'll record the initial position of the view, and
       pre-calculate the height. Then we turn animation on for all *other*
       instances of TodoListItemView (we don't want to animate this one, as it's
       going to track the cursor).
    */
    dragStarted ( drag ) {
        const itemHeight = this.get( 'itemHeight' );
        drag.startY = this.get( 'index' ) * itemHeight;
        drag.maxY = ( this.getFromPath( 'list.length' ) - 1 ) * itemHeight;
        this.animateLayer = false;
        TodoListItemView.prototype.animateLayer = true;
    },

    /* On move, update the position of this view, and work out if we have moved
       it to a new index in the list. If so, call the action to update the
       store. This will automatically update any affected views, and because
       animation is enabled, they will animate to their new positions.
    */
    dragMoved ( drag ) {
        const cursorPosition = drag.get( 'cursorPosition' );
        const startPosition = drag.get( 'startPosition' );
        const y = Math.max( 0, Math.min( drag.maxY,
            drag.startY + ( cursorPosition.y - startPosition.y ) ) );
        const currentIndex = this.get( 'index' );
        const newIndex = Math.round( y / this.get( 'itemHeight' ) );
        if ( newIndex !== currentIndex ) {
            actions.reorderTodo(
                this.get( 'list' ), this.get( 'content' ), newIndex
            );
        }
        this.set( 'layout', y );
    },

    /* Cleanup on drag end */
    dragEnded () {
        delete this.animateLayer;
        TodoListItemView.prototype.animateLayer = false;
        editStore.commitChanges();
    },
});

// --- Exports

export default TodoListItemView;
