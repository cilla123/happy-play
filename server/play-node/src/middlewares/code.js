const fs = require('fs');

/**
 * 读取状态值
 */
module.exports = function(codeFileConfig) {
    const CODE = fs.existsSync(`${codeFileConfig}`) ? require(`${codeFileConfig}`) : {};
    return async function code(ctx, next) {
        ctx.CODE = CODE;
        await next();
    };
};