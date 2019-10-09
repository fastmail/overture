// Subset of eslint/lib/rules/utils/ast-utils from eslint 6.5.1, for our forked
// object-shorthand to use, since not all supported versions of eslint have it.

function isArrowToken(token) {
    return token.value === "=>" && token.type === "Punctuator";
}

function isOpeningParenToken(token) {
    return token.value === "(" && token.type === "Punctuator";
}

function isOpeningBracketToken(token) {
    return token.value === "[" && token.type === "Punctuator";
}

function isClosingBracketToken(token) {
    return token.value === "]" && token.type === "Punctuator";
}

module.exports = {
    isArrowToken,
    isOpeningParenToken,
    isOpeningBracketToken,
    isClosingBracketToken,

    getStaticPropertyName(node) {
        let prop;

        switch (node && node.type) {
            case "Property":
            case "MethodDefinition":
                prop = node.key;
                break;

            case "MemberExpression":
                prop = node.property;
                break;

            // no default
        }

        switch (prop && prop.type) {
            case "Literal":
                return String(prop.value);

            case "TemplateLiteral":
                if (prop.expressions.length === 0 && prop.quasis.length === 1) {
                    return prop.quasis[0].value.cooked;
                }
                break;

            case "Identifier":
                if (!node.computed) {
                    return prop.name;
                }
                break;

            // no default
        }

        return null;
    },
};
