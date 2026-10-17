const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function sanitize(value) {
    if (typeof value !== 'string') return value;
    return value.split(root).join('<repositorio>').split(root.replaceAll('\\', '/')).join('<repositorio>')
        .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, '<perfil>')
        .replace(/\/(?:home|Users)\/[^/\s]+/g, '<perfil>')
        .replace(/(?:gh[pousr]_[\w]+|github_pat_[\w]+|sb_secret_[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)/g, '<secreto omitido>')
        .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1<credenciales>@')
        .replace(/((?:password|contrasena|token|api[_-]?key|authorization)\s*[=:]\s*)[^\s,;}]+/gi, '$1<omitido>');
}
function serializable(value, depth = 0) {
    if (value === undefined) return undefined;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return sanitize(value);
    if (depth > 32) return '[profundidad limitada]';
    if (Array.isArray(value)) return value.map(v => serializable(v, depth + 1));
    if (typeof value === 'object') {
        const out = {};
        for (const key of Object.getOwnPropertyNames(value)) {
            if (/^(password|contrasena|token|secret|authorization|api.?key)$/i.test(key)) out[key] = '<omitido>';
            else out[key] = serializable(value[key], depth + 1);
        }
        return out;
    }
    return sanitize(String(value));
}
module.exports = { root, sanitize, serializable };
