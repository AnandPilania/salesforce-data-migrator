export function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

export function formatDuration(duration) {
    return `${Math.round(duration / 1000)}s`;
}

export function formatMissingLabel(data) {
    return data.length > 0 ? data.map((obj) => {
        obj.label = obj.label.startsWith('__MISSING LABEL__') ? obj.name : obj.label;
        return obj;
    }) : data;
}
