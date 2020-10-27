/* eslint-disable max-len */
module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Class() needs Name',
            category: 'Possible Errors',
            recommended: true,
        },
        fixable: null,
        schema: [],  // no options
    },

    create(context) {
        return {
            'CallExpression > Identifier.callee[name = "Class"]'(identifierNode) {
                const callNode = identifierNode.parent;
                if (callNode.arguments.length !== 1) {
                    context.report({
                        node: callNode,
                        message: 'Class() requires one argument, params',
                    });
                    return;
                }
                const firstArg = callNode.arguments[0];
                if (firstArg.type !== 'ObjectExpression') {
                    context.report({
                        node: firstArg,
                        message: 'Class() params argument should be an object literal',
                    });
                    return;
                }
                if (!firstArg.properties.some(prop => (
                    prop.type === 'Property' &&
                    prop.key.type === 'Identifier' &&
                    prop.key.name === 'Name'
                ))) {
                    context.report({
                        node: firstArg,
                        message: 'Class() params should include Name',
                    });
                    return;
                }
            },
        };
    },
};
