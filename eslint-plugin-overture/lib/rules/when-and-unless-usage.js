/* eslint-disable max-len */
module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'when() and unless() usage checks (most notably, checking .end() is present)',
            category: 'Possible Errors',
            recommended: true,
        },
        fixable: null,
        schema: [],  // no options
    },

    create(context) {
        function getAndCheckCallExpression({
            data, callee, uncalledMessage, countCheck, badCountMessage,
        }) {
            const parent = callee.parent;
            const argCount =
                parent &&
                parent.type === 'CallExpression' &&
                parent.callee === callee
                    ? parent.arguments.length
                    : null;
            if (argCount === null) {
                context.report({
                    node: callee,
                    message: uncalledMessage,
                    data,
                });
                return;
            }
            if (!countCheck(argCount)) {
                context.report({
                    node: parent,
                    message: badCountMessage,
                    data: Object.assign({ count: argCount }, data),
                });
                return;
            }
            return parent;
        }

        function getMemberExpression(object) {
            const parent = object.parent;
            const name =
                parent &&
                parent.type === 'MemberExpression' &&
                parent.object === object &&
                parent.property.type === 'Identifier'
                    ? parent.property.name
                    : null;
            return [parent, name];
        }

        return {
            'CallExpression > Identifier.callee:matches([name = "when"], [name = "unless"])'(whenIdentifierNode) {
                const data = {
                    when: whenIdentifierNode.name,
                };
                const whenCallExpression = getAndCheckCallExpression({
                    data,
                    callee: whenIdentifierNode,
                    uncalledMessage: '{{when}} referred to without calling it',
                    countCheck: count => count === 2 || count === 3,
                    badCountMessage: '{{when}}() expects two or three arguments, got {{count}}',
                });
                if (!whenCallExpression) {
                    return;
                }

                const [showMemberExpression, showName] =
                    getMemberExpression(whenCallExpression);
                if (showName === 'then') {
                    context.report({
                        node: whenCallExpression,
                        message: ".show() misspelled as .then() in '{{when}}' construct",
                        data,
                    });
                    return;
                } else if (showName !== 'show') {
                    context.report({
                        node: whenCallExpression,
                        message: "expected '{{when}}' call to be followed by .show()",
                        data,
                    });
                    return;
                }

                let currentCallExpression = getAndCheckCallExpression({
                    data,
                    callee: showMemberExpression,
                    uncalledMessage: "{{when}}(...).show isn't called",
                    countCheck: count => count === 1,
                    badCountMessage: '{{when}}(...).show() expects one argument, got {{count}}',
                });

                let [nextMemberExpression, nextName] =
                    getMemberExpression(currentCallExpression);
                const hasOtherwise = nextName === 'otherwise';
                if (hasOtherwise) {
                    const otherwiseCallExpression = getAndCheckCallExpression({
                        data,
                        callee: nextMemberExpression,
                        uncalledMessage: "{{when}}(...).show(...).otherwise isn't called",
                        countCheck: count => count === 1,
                        badCountMessage: '{{when}}(...).show(...).otherwise expects one argument, got {{count}}',
                    });
                    if (!otherwiseCallExpression) {
                        return;
                    }
                    currentCallExpression = otherwiseCallExpression;
                    [nextMemberExpression, nextName] =
                        getMemberExpression(currentCallExpression);
                }

                if (!nextName) {
                    context.report({
                        node: whenCallExpression,
                        message: ".end() missing on '{{when}}' construct",
                        data,
                    });
                    return;
                }

                if (nextName !== 'end') {
                    context.report({
                        node: whenCallExpression,
                        message: "expected .end() on '{{when}}' construct, not .{{name}}()",
                        data: Object.assign({ name: nextName }, data),
                    });
                    return;
                }

                currentCallExpression = getAndCheckCallExpression({
                    data,
                    callee: nextMemberExpression,
                    uncalledMessage: "{{when}}(...).{...}.end isn't called",
                    countCheck: count => count === 0,
                    badCountMessage: '{{when}}(...).{...}.end() expects no arguments, got {{count}}',
                });
                if (!currentCallExpression) {
                    return;
                }

                const parent = currentCallExpression.parent;
                if (
                    parent && (
                        (
                            parent.type === 'MemberExpression' &&
                            parent.object === currentCallExpression
                        ) ||
                        (
                            (
                                parent.type === 'CallExpression' ||
                                parent.type === 'NewExpression'
                            ) &&
                            parent.callee === currentCallExpression
                        )
                    )
                ) {
                    context.report({
                        node: parent,
                        message: "expected nothing after .end() on '{{when}} construct",
                        data,
                    });
                }
            },
        };
    },
};
