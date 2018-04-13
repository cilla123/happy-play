const { resolve } = require('path');
const fs = require('fs');

module.exports = function(path, options) {
    if (!path) {
        return (ctx, next) => {
            return next();
        };
    }

    path = resolve(path);
    options = options || {};

    let icon;
    const maxAge = options.maxAge == null ? 86400000 : Math.min(Math.max(0, options.maxAge), 31556926000);
    const cacheControl = `public, max-age=${maxAge / 1000 | 0}`;

    return async function favicon(ctx, next) {
        if (!/favicon.ico/.test(ctx.path)) {
            return next();
        }

        if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
            ctx.status = ctx.method === 'OPTIONS' ? 200 : 405;
            ctx.set('Allow', 'GET, HEAD, OPTIONS');
        } else {
            // 延时加载读取
            if (!icon) icon = fs.readFileSync(path);
            ctx.set('Cache-Control', cacheControl);
            ctx.type = 'image/x-icon';
            ctx.body = icon;
        }
    };
};