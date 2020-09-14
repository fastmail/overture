const isId = /^[A-Z0-9_]+$/;

// Input: contents of a .db file
// Output: JSON representation: {id, string, description}[]
const parseDb = function (text) {
    const db = [];
    let id, obj;
    text.split('\n').forEach((line) => {
        line = line.trim();
        // ID
        if (isId.test(line)) {
            id = line;
            obj = {
                id: id,
            };
            db.push(obj);
        } else if (/^".*"$/.test(line)) {
            // String
            if (!id) {
                console.log('Error: Found a string before an id - ' + line);
            } else {
                try {
                    obj.string = JSON.parse(line);
                } catch (error) {
                    console.log(
                        'Error: String is not properly escaped - ' + line,
                    );
                }
            }
        } else if (/^\[.*\]$/.test(line)) {
            // Description
            if (!id) {
                console.log('Error: Found a description before an id -' + id);
            } else {
                obj.description = line.slice(1, -1);
            }
        }
    });
    return db;
};

export default parseDb;
