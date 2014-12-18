/*global O */

"use strict";

var view = new O.View({

    id: 'Application',

    string: 'There [*2,_1,is %n thing,are %n things,is nothing] to know about [_2] strings.',
    arg1: '3',
    arg2: 'localised',
    arg3: '',

    output: function () {
        var arg1 = this.get( 'arg1' ),
            arg2 = this.get( 'arg2' ),
            arg3 = this.get( 'arg3' ),
            result = '<Invalid>';

        arg1 = /^\d+$/.test( arg1 ) ? parseInt( arg1, 10 ) : arg1;
        arg2 = /^\d+$/.test( arg2 ) ? parseInt( arg2, 10 ) : arg2;
        arg3 = /^\d+$/.test( arg3 ) ? parseInt( arg3, 10 ) : arg3;

        try {
            result = O.loc( this.get( 'string' ), arg1, arg2, arg3 );
        } catch ( e ) {}

        return result;
    }.property( 'string', 'arg1', 'arg2', 'arg3' ),

    draw: function ( layer, Element, el ) {
        return [
            el( 'h1', [ 'Localised String Tester' ]),
            el( 'h2', [ 'Your localised string:' ]),
            new O.TextView({
                multiline: true,
                expanding: true,
                value: new O.Binding({
                    isTwoWay: true
                }).from( 'string', this )
            }),
            el( 'h2', [ 'combined with arguments:' ]),
            el( 'div', { style: 'overflow: hidden' }, [
                [ 1, 2, 3 ].map( function ( num ) {
                    return el( 'label.arg', [
                        num + '. ',
                        new O.TextView({
                            value: new O.Binding({
                                isTwoWay: true
                            }).from( 'arg' + num, this )
                        })
                    ]);
                }, this )
            ]),
            el( 'h2', [ 'results in:' ]),
            el( 'p', {
                text: O.bind( 'output', this )
            })
        ];
    }
});

new O.RootView( document ).insertView( view );
