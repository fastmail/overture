module.exports = {
    extends: 'stylelint-config-standard',
    plugins: ['stylelint-order'],
    rules: {
        'no-descending-specificity': null,
        'custom-property-empty-line-before': null,
        'declaration-colon-newline-after': null,
        'indentation': null,
        'rule-empty-line-before': null,
        'at-rule-no-unknown': [
            true,
            { ignoreAtRules: ['if', 'mobile', 'desktop', 'for'] },
        ],
        'at-rule-empty-line-before': ['always', { except: ['inside-block'] }],
        'order/properties-order': [
            [
                {
                    groupName: 'content',
                    properties: [
                        'content',
                        'counter-increment',
                        'counter-reset',
                    ],
                },
                {
                    groupName: 'animation',
                    properties: [
                        'animation',
                        'animation-delay',
                        'animation-direction',
                        'animation-duration',
                        'animation-fill-mode',
                        'animation-iteration-count',
                        'animation-name',
                        'animation-play-state',
                        'animation-timing-function',
                        'transition',
                    ],
                },
                {
                    groupName: 'displayMode',
                    properties: [
                        'z-index',
                        'overflow',
                        'appearance',
                        'box-sizing',
                        'display',
                        'position',
                        'float',
                        'clear',
                        'vertical-align',
                    ],
                },
                {
                    groupName: 'flexProperties',
                    properties: [
                        'flex',
                        'order',
                        'align-content',
                        'align-items',
                        'align-self',
                        'flex-basis',
                        'flex-direction',
                        'flex-flow',
                        'flex-grow',
                        'flex-shrink',
                        'flex-wrap',
                        'gap',
                        'row-gap',
                        'column-gap',
                        'grid-area',
                        'grid-row',
                        'grid-column',
                        'grid-row-start',
                        'grid-column-start',
                        'grid-row-end',
                        'grid-column-end',
                        'grid-auto-flow',
                        'grid-auto-rows',
                        'grid-auto-columns',
                        'grid-template',
                        'grid-template-areas',
                        'grid-template-rows',
                        'grid-template-columns',
                        'justify-content',
                        'place-content',
                        'place-items',
                        'place-self',
                    ],
                },
                {
                    groupName: 'boxModel',
                    properties: [
                        'transform',
                        'rotate',
                        // ---
                        'inset',
                        'top',
                        'right',
                        'bottom',
                        'left',
                        // ---
                        'margin',
                        'margin-top',
                        'margin-right',
                        'margin-bottom',
                        'margin-left',
                        // ---
                        'border',
                        'border-top',
                        'border-right',
                        'border-bottom',
                        'border-left',
                        'border-width',
                        'border-top-width',
                        'border-right-width',
                        'border-bottom-width',
                        'border-left-width',
                        // ---
                        'padding',
                        'padding-top',
                        'padding-right',
                        'padding-bottom',
                        'padding-left',
                        // ---
                        'width',
                        'min-width',
                        'max-width',
                        'height',
                        'min-height',
                        'max-height',
                        'line-height',
                    ],
                },
            ],
            // everything else!
            { unspecified: 'bottomAlphabetical' },
        ],
    },
};
