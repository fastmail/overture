/* eslint-disable max-len */
module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: '.get() and .getFromPath usage checks',
            category: 'Possible Errors',
            recommended: true,
        },
        fixable: null,
        schema: [],  // no options
    },

    create(context) {
        return {
            'CallExpression > MemberExpression.callee > Identifier.property:matches([name = "get"], [name = "getFromPath"])'(identifierNode) {
                const callNode = identifierNode.parent.parent;
                const method = callNode.callee.property.name;
                const firstArg = callNode.arguments[0];
                if (firstArg && firstArg.type === 'Literal') {
                    const hasDot = firstArg.value.includes('.');
                    if (method === 'get' && hasDot) {
                        context.report({
                            node: callNode,
                            message: '.get() takes a key, not a path; use .getFromPath() instead',
                        });
                    } else if (method === 'getFromPath' && !hasDot) {
                        context.report({
                            node: callNode,
                            message: '.getFromPath() takes a path, but this is just a key; use .get() instead',
                        });
                    }
                    return;
                }
            },
        };
    },
};
