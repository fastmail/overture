/* eslint-disable max-len */
module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'SwitchView shorthand usage checks',
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

        function expectEnd(
            alternative,
            { data, initialCallExpression, nextMemberExpression, nextName }
        ) {
            if (!nextName) {
                context.report({
                    node: initialCallExpression,
                    message: ".end() missing on '{{initialNodeName}}' construct",
                    data,
                });
                return;
            }

            if (nextName !== 'end') {
                context.report({
                    node: initialCallExpression,
                    message: `expected .end()${alternative} on '{{initialNodeName}}' construct, not .{{name}}`,
                    data: Object.assign({ name: nextName }, data),
                });
                return;
            }

            const currentCallExpression = getAndCheckCallExpression({
                data,
                callee: nextMemberExpression,
                uncalledMessage: "{{initialNodeName}}(...).{...}.end isn't called",
                countCheck: count => count === 0,
                badCountMessage: '{{initialNodeName}}(...).{...}.end() expects no arguments, got {{count}}',
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
                    message: "expected nothing after .end() on '{{initialNodeName}} construct",
                    data,
                });
            }
        }

        return {
            'CallExpression > Identifier.callee:matches([name = "choose"])'(chooseIdentifierNode) {
                const data = {
                    initialNodeName: chooseIdentifierNode.name,
                };
                const initialCallExpression = getAndCheckCallExpression({
                    data,
                    callee: chooseIdentifierNode,
                    uncalledMessage: '{{initialNodeName}} referred to without calling it',
                    countCheck: count => count === 2 || count === 3,
                    badCountMessage: '{{initialNodeName}}() expects two or three arguments, got {{count}}',
                });
                if (!initialCallExpression) {
                    return;
                }

                let currentCallExpression = initialCallExpression;
                let atLeastOneCaseEncountered = false;
                let nextMemberExpression;
                let nextName;
                while (true) {
                    [nextMemberExpression, nextName] =
                        getMemberExpression(currentCallExpression);
                    if (nextName !== 'case') {
                        if (!atLeastOneCaseEncountered) {
                            context.report({
                                node: initialCallExpression,
                                message: "expected '{{initialNodeName}}' call to be followed by .case()",
                                data,
                            });
                            return;
                        }
                        break;
                    }
                    atLeastOneCaseEncountered = true;

                    currentCallExpression = getAndCheckCallExpression({
                        data,
                        callee: nextMemberExpression,
                        uncalledMessage: "{{initialNodeName}}(...).case isn't called",
                        countCheck: count => count === 2,
                        badCountMessage: '{{initialNodeName}}(...).case() expects two arguments, got {{count}}',
                    });
                    if (!currentCallExpression) {
                        return;
                    }
                }

                expectEnd(
                    ' or .case(...)',
                    { data, initialCallExpression, nextMemberExpression, nextName }
                );
            },
            'CallExpression > Identifier.callee:matches([name = "when"], [name = "unless"])'(whenIdentifierNode) {
                const data = {
                    initialNodeName: whenIdentifierNode.name,
                };
                const initialCallExpression = getAndCheckCallExpression({
                    data,
                    callee: whenIdentifierNode,
                    uncalledMessage: '{{initialNodeName}} referred to without calling it',
                    countCheck: count => count === 2 || count === 3,
                    badCountMessage: '{{initialNodeName}}() expects two or three arguments, got {{count}}',
                });
                if (!initialCallExpression) {
                    return;
                }

                const [showMemberExpression, showName] =
                    getMemberExpression(initialCallExpression);
                if (showName === 'then') {
                    context.report({
                        node: initialCallExpression,
                        message: ".show() misspelled as .then() in '{{initialNodeName}}' construct",
                        data,
                    });
                    return;
                } else if (showName !== 'show') {
                    context.report({
                        node: initialCallExpression,
                        message: "expected '{{initialNodeName}}' call to be followed by .show()",
                        data,
                    });
                    return;
                }

                let currentCallExpression = getAndCheckCallExpression({
                    data,
                    callee: showMemberExpression,
                    uncalledMessage: "{{initialNodeName}}(...).show isn't called",
                    countCheck: count => count === 1,
                    badCountMessage: '{{initialNodeName}}(...).show() expects one argument, got {{count}}',
                });

                let [nextMemberExpression, nextName] =
                    getMemberExpression(currentCallExpression);
                const hasOtherwise = nextName === 'otherwise';
                if (hasOtherwise) {
                    const otherwiseCallExpression = getAndCheckCallExpression({
                        data,
                        callee: nextMemberExpression,
                        uncalledMessage: "{{initialNodeName}}(...).show(...).otherwise isn't called",
                        countCheck: count => count === 1,
                        badCountMessage: '{{initialNodeName}}(...).show(...).otherwise expects one argument, got {{count}}',
                    });
                    if (!otherwiseCallExpression) {
                        return;
                    }
                    currentCallExpression = otherwiseCallExpression;
                    [nextMemberExpression, nextName] =
                        getMemberExpression(currentCallExpression);
                }

                expectEnd(
                    hasOtherwise ? '' : ' or .otherwise(...)',
                    { data, initialCallExpression, nextMemberExpression, nextName }
                );
            },
        };
    },
};
