function multiSearchAnd(text, search) {
    text = text.toLocaleString();
    const words = search.split(' ');
    for (const word of words) {
        if (word === '') {
            continue;
        }
        if (!text.includes(word)) {
            return false;
        }
    }
    return true;
}

module.exports = {
    multiSearchAnd
};
