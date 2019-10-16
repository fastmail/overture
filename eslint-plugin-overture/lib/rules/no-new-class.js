module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'disallow `new` operator with the `Class` objects',
            category: 'Best Practices',
            recommended: true,
        },
        schema: [],
    },

    create(context) {
        return {
            'NewExpression[callee.name = "Class"]'(node) {
                context.report({
                    node,
                    message: 'Do not use Class as a constructor.',
                });
            },
        };
    },
};
