const sniffContentType = (type, name) => {
    switch (type) {
        case 'application/jpg':
        case 'image/jpg':
            type = 'image/jpeg';
            break;
        case 'application/png':
            type = 'image/png';
            break;
        case 'application/x-any': // Garbage created by JAVA mail (I think)
        case 'application/word': // Seen in the wild for a PDF
        case 'application/binary': // Seen in the wild for a PDF
            type = 'application/octet-stream';
        /* falls through */
        default:
            // Use extension to determine MIME type for files where the type
            // given is commonly wrong
            if (/\.pdf$/i.test(name)) {
                type = 'application/pdf';
            } else if (/\.pkpass$/.test(name)) {
                type = 'application/vnd.apple.pkpass';
            } else if (/\.jpe?g$/i.test(name)) {
                // Broken crap from cheap security cameras
                type = 'image/jpeg';
            } else if (/\.mp3$/i.test(name)) {
                // Orange.fr sends voice messages via email with mp3
                // attachments, but application/octet-stream MIME type
                type = 'audio/mpeg';
            }
            break;
    }
    return type;
};

export { sniffContentType };
