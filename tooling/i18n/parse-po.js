const item = /^msg(ctxt|id|str)\s*(""|".*?[^\\]")\s*$/;
const extra = /^(""|".*?[^\\]")\s*$/;
const comment = /^#([.:,])\s(.*)$/;
const translateItemPart = {
    ctxt: 'id',
    id: 'string',
    str: 'translation',
};
const translateCommentPart = {
    ',': 'flag',
    '.': 'description',
    ':': 'context',
};

// Input: contents of a .po file
// Output: JSON representation: id[{ id, string, translation, flags }]
const parsePo = function (text) {
    const results = {};
    const lines = text.split('\n');
    let obj = {};
    let line, part, string, i, l, match, isPrev, flags;
    for (i = 0, l = lines.length; i < l; i += 1) {
        line = lines[i];
        if (!line) {
            // New block
            obj = {};
            continue;
        }
        if (/^#\| /.test(line)) {
            isPrev = true;
            line = line.slice(3);
        } else {
            isPrev = false;
        }
        match = item.exec(line);
        if (match) {
            part = translateItemPart[match[1]];
            try {
                string = JSON.parse(match[2]);
            } catch (e) {
                string = '';
                console.log('Parse error at line ' + (i + 1));
                console.log('Perhaps it contains control characters?');
                console.log(match[2].split(''));
            }
            while (true) {
                line = lines[i + 1] || '';
                if (isPrev) {
                    if (/^#| /.test(line)) {
                        line = line.slice(3);
                    } else {
                        break;
                    }
                }
                if (!extra.test(line)) {
                    break;
                }
                i += 1;
                try {
                    string += JSON.parse(lines[i]);
                } catch (e) {
                    console.log('Parse error at line ' + (i + 1));
                    console.log(lines[i]);
                }
            }
            // The empty string may be written as '[]'.
            // This is for legacy compatibility with translang's tools.
            if (string === '[]') {
                string = '';
            }
            obj[isPrev ? 'prevString' : part] = string;
            if (part === 'id') {
                results[string] = obj;
            }
            continue;
        }
        match = comment.exec(line);
        if (match) {
            part = translateCommentPart[match[1]];
            string = match[2];
            if (part === 'flag') {
                flags = string.split(',').map((s) => s.trim());
                if (obj.flags) {
                    obj.flags = obj.flags.concat(flags);
                } else {
                    obj.flags = flags;
                }
            }
            if (part === 'description') {
                if (obj.description) {
                    obj.description += ' ' + string;
                } else {
                    obj.description = string;
                }
            }
            if (part === 'context') {
                if (obj.context) {
                    obj.context.push(string);
                } else {
                    obj.context = [string];
                }
            }
        }
    }
    return results;
};

export default parsePo;
