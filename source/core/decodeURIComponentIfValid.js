const decodeURIComponentIfValid = (value) => {
    try {
        value = decodeURIComponent(value);
    } catch (error) {}
    return value;
};

export { decodeURIComponentIfValid };
