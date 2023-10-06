import fs from 'fs';
import path from 'path';
import prettier from 'prettier';
import { parseICUString } from '../tooling/i18n/compile-translation.js';
import { execSync } from 'child_process';

/* globals process */

const codeToLanguage = {
    'bg': 'Bulgarian',
    'cs': 'Czech',
    'da': 'Danish',
    'de': 'German',
    'es': 'Spanish',
    'es-la': 'Spanish',
    'fi': 'Finnish',
    'fr': 'French',
    'hu': 'Hungarian',
    'id': 'Indonesian',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'nl': 'Dutch',
    'nb': 'Norwegian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'sk': 'Slovak',
    'sv': 'Swedish',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'vi': 'Vietnamese',
    'zh': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
};

const compareSourceAndTranslation = (source, translation, languageCode) => {
    const sourceTargetValues = parseICUString(source).filter(
        (sourceObj) => !!sourceObj.value,
    );
    const sourceVariables = sourceTargetValues.map((sourceObj) => {
        return sourceObj.value;
    });

    // Depending on the target language, variables might be duplicated.
    // E.g. The verb preceding the variable changes with pluralisation
    const translationValueMap = parseICUString(translation).reduce(
        (map, translationObj) => {
            const value = translationObj.value;
            if (sourceVariables.includes(value)) {
                const previousValue = map[value];
                if (previousValue) {
                    map[value].push(translationObj);
                } else {
                    map[value] = [translationObj];
                }
            }
            return map;
        },
        {},
    );

    return sourceTargetValues.every((sourceObj) => {
        const translationObjs = translationValueMap[sourceObj.value];
        if (!translationObjs) {
            return false;
        }
        const substitutions = sourceObj.substitutions;
        const sourceSubstitutionKeys =
            substitutions && Object.keys(substitutions);
        if (sourceSubstitutionKeys && sourceSubstitutionKeys.length) {
            return translationObjs.every((translationObj) => {
                // If substitutions exist, we check the translation for
                // plurality validity according to that language's rules
                let substitutionKeys = Object.keys(
                    translationObj.substitutions,
                );

                // Check exact # (=0, =12) plurality equivalence
                if (
                    sourceSubstitutionKeys.some(
                        (sub) =>
                            sub.startsWith('=') &&
                            !substitutionKeys.includes(sub),
                    )
                ) {
                    return false;
                }
                substitutionKeys = substitutionKeys.filter(
                    (sub) => !sub.startsWith('='),
                );

                switch (languageCode) {
                    case 'id':
                    case 'ja':
                    case 'ko':
                    case 'vi':
                    case 'zh':
                    case 'zh-tw':
                        // These languages only use 'other', but don't reject on
                        // extra pluralities. E.g. lots of our Japanese strings
                        // use the same translation for 'one' and 'other'.
                        // Really, we just need *any* plurality to not break.
                        return substitutionKeys.length;
                    case 'fr':
                    case 'fr-ca':
                    case 'pt-br':
                    case 'bg':
                    case 'da':
                    case 'de':
                    case 'en':
                    case 'en-gb':
                    case 'es':
                    case 'es-la':
                    case 'fi':
                    case 'hu':
                    case 'it':
                    case 'nb':
                    case 'nl':
                    case 'nn':
                    case 'pt':
                    case 'sv':
                    case 'tr':
                        // These only use 'one' or 'other'
                        return substitutionKeys.every((substitution) =>
                            ['one', 'other'].includes(substitution),
                        );
                    case 'sk':
                    case 'cs': {
                        // 'many' is for decimals, but we use positional args,
                        // so we need to reject if it is included, or it will
                        // override 'other'
                        return substitutionKeys.every((substitution) =>
                            ['one', 'few', 'other'].includes(substitution),
                        );
                    }
                    case 'pl':
                    case 'uk':
                    case 'ru': {
                        // 'other' is for decimals, so we don't require it,
                        // but don't reject if it is included
                        return ['one', 'few', 'many'].every((substitution) =>
                            substitutionKeys.includes(substitution),
                        );
                    }
                    default: {
                        return false;
                    }
                }
            });
        } else {
            return true;
        }
    });
};

const loadCSV = (pathToCsv) =>
    fs
        .readFileSync(path.join('./', pathToCsv))
        .toString()
        .trim()
        .split('\n')
        .map((line) => line.slice(1, -1).split('","'));

const loadTarget = (pathToTarget) =>
    // eslint-disable-next-line no-eval
    eval(
        fs
            .readFileSync(path.join('./', pathToTarget))
            .toString()
            .replace('export default ', '(function () {return ') + '})();',
    );

// Single ' characters within a translation can cause it to be parsed
// incorrectly, as it can create a quote pair with the surrounding " characters.
// Converting ' to rsquo; avoids this.
const escapeAccents = (string) =>
    string ? string.replaceAll(/'/g, '’') : string;

const locCSVToJson = (csvPath, langFile) => {
    const fileArg = csvPath || process.argv[2];
    const langFilePath = langFile || process.argv[3];
    const langCode = /\/([-\w]+).lang.js$/.exec(langFilePath)[1];
    const csv = loadCSV(fileArg);
    const lang = loadTarget(langFilePath);
    const targetLanguageIndex = csv[0].findIndex(
        (header) => header === codeToLanguage[langCode],
    );
    const warnings = [];

    if (targetLanguageIndex === -1) {
        const language = codeToLanguage[langCode] || langCode;
        warnings.push('No column exists for language: "' + language + '"\n');
        return warnings;
    }

    let langAtExport;
    let commit;
    try {
        commit = /SHA([a-zA-Z0-9]+).csv$/.exec(fileArg)?.[1];

        if (!commit) {
            throw new Error('No commit to check out');
        }

        //Sanitize langFilePath
        if (!/^[a-zA-Z0-9\-_ \/\.]+$/.test(langFilePath)) {
            throw new Error('Invalid file path');
        }

        // eslint-disable-next-line no-eval
        langAtExport = eval(
            execSync(`git show ${commit}:./${langFilePath}`)
                .toString()
                .replace('export default ', '(function () {return ') + '})();',
        );
    } catch (error) {
        warnings.push('Unable to find origin commit for CSV file.\n');
    }

    csv.forEach((line) => {
        const id = line[0];
        const sourceString = line[1];
        if (id === 'String ID') {
            return;
        }

        const rawTranslation = line[targetLanguageIndex];
        const translation = escapeAccents(rawTranslation);
        // There's a circumstance in which an intentionally single-quoted phrase
        // exists, and the single-quotes will be replaced by the escapeAccents
        // function. However, multiple accents in a translation have already led
        // to erroneously single-quoted phrases slipping through.
        let warnForMultiReplace = false;
        if (rawTranslation.match(/'/g)?.length > 1) {
            warnForMultiReplace = true;
        }

        const target = lang[id];
        if (!translation) {
            return;
        }
        if (!target) {
            warnings.push(`${id} does not exist in target dictionary.\n`);
            return;
        }

        if (langAtExport) {
            const exportSource = langAtExport[id];
            if (exportSource.string !== target.string) {
                warnings.push(
                    id +
                        ': Source string has changed since translation cycle was initiated. This string will not be updated.\n',
                );
                return;
            }
            if (exportSource.translation !== target.translation) {
                warnings.push(
                    id +
                        `: The translation at the time of export (${commit}) does not match the translation at the current HEAD.\n`,
                );
                return;
            }
        }

        // Reject if same as source string
        if (translation === escapeAccents(sourceString)) {
            return;
        }
        if (!compareSourceAndTranslation(sourceString, translation, langCode)) {
            warnings.push(
                id +
                    ': Source String and Translation do not match. \nSource String: ' +
                    sourceString +
                    '\nTranslation: ' +
                    translation,
                '\n',
            );
            return;
        }

        // If multiple single-quotes in a translation were replaced, and the
        // translation has actually changed, log a warning.
        if (target.translation !== translation && warnForMultiReplace) {
            warnings.push(
                `WARNING: Replaced multiple single quotes in ${id}\n`,
            );
        }

        target.translation = translation;
        if (target.flags && target.flags.includes('fuzzy')) {
            let newFlags = target.flags.filter((flag) => flag !== 'fuzzy');
            if (!newFlags.length) {
                newFlags = undefined;
            }
            target.flags = newFlags;
        }
    });

    fs.writeFileSync(
        langFilePath,
        prettier.format(
            '/* eslint-disable import/no-default-export */\nexport default ' +
                JSON.stringify(lang),
            {
                singleQuote: false,
                tabWidth: 4,
                quoteProps: 'as-needed',
                trailingComma: 'all',
                parser: 'babel',
            },
        ),
    );

    return warnings;
};

export { locCSVToJson };
