const { BusinessError, ParamsError } = require('../../../play-node');

module.exports = async(ctx, next) => {
  try {
    await next();
  } catch (e) {
    if (e instanceof BusinessError) {
      console.log(e.errorContent);
      // TODO
    } else if (e instanceof ParamsError) {
      console.log(e.errorContent);
      // TODO
    } else {
      throw e;
    }
  }
};
