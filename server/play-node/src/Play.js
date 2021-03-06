const Koa = require('koa')
const Emitter = require('events')
const { resolve } = require('path')
const debug = require('debug')
const { defaultsDeep } = require('lodash')
const ip = require('ip')
const boxen = require('boxen')

const middlewares = require('./middlewares')
const Loader = require('./libs/loader')
const pkg = require('../package.json')
const router = require('./middlewares/router')
const router2 = require('./middlewares/router2')
const router3 = require('./middlewares/router3')

const {
    BusinessError,
    ParamsError,
    Exception_404
} = require('./base/Error')
const Validator = require('./base/Validator')
const Controller = require('./base/Controller')
const Service = require('./base/Service')
const libRouter = require('./libs/router')
const viewEnv = require('./middlewares/nunjucks/env')
const rewrite = require('./middlewares/rewrite')
const code = require('./middlewares/code')
const body = require('./middlewares/body')
const koaStatic = require('./middlewares/static')

const validator = new Validator()

class Happy extends Emitter {

    constructor(config){
        super()
        this.app = new Koa()
        this.config = config || {}
        this.config.SERVER_ROOT = this.config.SERVER_ROOT || this.defaultServerRoot
        if (this.config.STATIC_PATH) {
            this.config.STATIC_PATH = resolve(this.config.SERVER_ROOT, this.config.STATIC_PATH)
        }
        // 合并环境和默认的配置文件
        this.config = defaultsDeep({}, this.envConfig, this.config, this.defaultConfig)

        process.env.NODE_ENV = this.config.NODE_ENV
        process.env.NODE_PORT = this.config.NODE_PORT

        this.app.config = this.config
        this.app.keys = this.config.KEYS
        this.app.env = this.config.NODE_ENV

        this.middlewares = middlewares(this.config)
        // 初始化加载器
        this.loader = new Loader(this.config)
        // 加载项目配置
        this.app.projectConfig = this.loader.loadProjectConfig()
        // 加载Version文件
        this.config.VERSION_MAP = this.loader.loadVersionMap()
        // 加载Controllers文件
        this.app.controllers = this.loader.loadControllers()
        // 加载目录 server/middlewares 下的所有中间件
        this.projectMiddlewares = this.loader.loadMiddlewares()
        // 加载中间配置
        this.middlewareConfig = defaultsDeep({}, this.loader.loadMiddlewareConfig(), this.defaultMiddlewareConfig)
        this.loader.loadContextExtend()
        this.loader.loadViewExtend()
        // HappyNode version
        this.config.HAPPY_VERSION = pkg.version
        // 把框架中间件跟业务中间件都合并到 allMiddlewares
        this.allMiddlewares = [].concat(this.middlewares).concat(this.projectMiddlewares)

        this.run()
        return this
    }

    // 默认配置
    get defaultConfig(){
        const SERVER_ROOT = this.config.SERVER_ROOT
        return {
            KEYS: ['im a newer secret', 'i like turtle'],
            NODE_ENV: 'development',
            NODE_PORT: 3000,
            FAVICON_PATH: resolve(SERVER_ROOT, 'favicon.ico'),
            STATIC_PATH: resolve(SERVER_ROOT, '../static'),
            CODE_PATH: resolve(SERVER_ROOT, 'constants/code.js'),
            CONFIG_PATH: resolve(SERVER_ROOT, 'config'),
            SEO_PATH: resolve(SERVER_ROOT, 'constants/site.js'),
            VIEW_PATH: resolve(SERVER_ROOT, 'views'),
            ROUTERS_PATH: resolve(SERVER_ROOT, 'routes'),
            CONTROLLERS_PATH: resolve(SERVER_ROOT, 'controllers'),
            EXTEND_PATH: resolve(SERVER_ROOT, 'extends'),
            XSS_WHITELISTS: [],
            CDN_PATH: '//www.cdn.com',
            beforeLoadMiddlewares() {},
            MIDDLEWARES_PATH: resolve(SERVER_ROOT, 'middlewares'),
            MIDDLEWARES_CONFIG_PATH: resolve(SERVER_ROOT, 'config/middlewares.js'),
            // iron 目录结构
            IRON_DIR: false,
            SRC_PATH: resolve(SERVER_ROOT, 'src'),
            // 所有中间件（框架+业务中间件）可配，默认 false
            AUTO_MIDDLEWARE: false
        }
    }

    // 环境配置
    get envConfig(){
        return {
            NODE_ENV: process.env.NODE_ENV,
            NODE_PORT: process.env.NODE_PORT
        }
    }

    // 运行根目录
    get defaultServerRoot(){
        let defaultServerRoot
        if (/server_dist|bin/.test(process.mainModule.filename)) {
            defaultServerRoot = resolve(process.cwd(), 'server_dist')
        } else {
            defaultServerRoot = resolve(process.cwd(), 'server')
        }
        return defaultServerRoot
    }

    // 默认的中间件
    get defaultMiddlewareConfig(){
        return {
            framework: [
                'health',
                'mixin',
                'favicon',
                'static',
                'helmet',
                'code',
                'seo',
                'nunjucks',
                'log',
                'body',
                'xss'
            ],
            project: [],
            custom: []
        }
    }

    // 自动加载业务中间件
    autoLoadMiddlewares() {
        const middlewareDebug = debug('happy:middleware');
        const middlewares = require(this.config.MIDDLEWARES_PATH);
        if (Array.isArray(middlewares)) {
            for (let i = 0; i < middlewares.length; i++) {
                this.middlewares.push({
                    name: middlewares[i].name || 'anonymous',
                    fn: middlewares[i]
                });
            }
        } else {
            this.config.beforeLoadMiddlewares.call(this);
        }

        for (let i = 0; i < this.middlewares.length; i++) {
            middlewareDebug('use %s', this.middlewares[i].name || '-');
            this.app.use(this.middlewares[i].fn);
        }
    }

    autoLoadMiddlewares2() {
        const middlewareDebug = debug('happy:middleware');

        // 加载框架中间件
        const frameworkMiddlewares = this.middlewareConfig.framework;
        for (let i = 0; i < frameworkMiddlewares.length; i++) {
            const middleware = this.allMiddlewares.find((item) => {
                return item.name === frameworkMiddlewares[i]
            });
            if (middleware) {
                middlewareDebug('use %s type %s', middleware.name || '-', middleware.type || '-');
                this.app.use(middleware.fn);
            }
        }

        // 加载项目中间件
        const projectMiddlewares = this.middlewareConfig.project;
        for (let i = 0; i < projectMiddlewares.length; i++) {
            const middleware = this.allMiddlewares.find((item) => {
                return item.name === projectMiddlewares[i];
            });
            if (middleware) {
                middlewareDebug('use %s type %s', middleware.name || '-', middleware.type || '-');
                this.app.use(middleware.fn);
            }
        }

        const customMiddlewares = this.middlewareConfig.custom;
        for (let i = 0; i < customMiddlewares.length; i++) {
            let execute = [];
            for (let j = 0; j < customMiddlewares[i].list.length; j++) {
                const middleware = this.allMiddlewares.find((item) => {
                    return item.name === customMiddlewares[i].list[j];
                });
                if (middleware) {
                    execute.push(middleware.fn);
                }
            }
            if (execute.length > 0) {
                libRouter.use(customMiddlewares[i].match, execute);
            }
        }
    }

    run() {
        if (this.config.AUTO_MIDDLEWARE) {
            this.autoLoadMiddlewares2();
        } else {
            this.autoLoadMiddlewares();
        }

        if (this.config.IRON_DIR) {
            this.app.use(router3(this.config));
        } else {
            // 路由1：自定义路由方式1
            router(this.app, this.config);
            // 路由2：根据目录结构路由
            this.app.use(router2(this.app));
            this.app.use(libRouter.routes());
            this.app.use(libRouter.allowedMethods());
        }

        let defaultErrorCallback = (err) => {
            console.log('<defaultErrorCallback>');
            console.log(err);
        };

        this.app.on('error', this.config.ERROR_CALLBACK || defaultErrorCallback);

        this.app.listen(this.config.NODE_PORT, () => {
            this.emit('start');
            if (this.config.NODE_ENV === 'development') {
                let msg = `服务启动成功!

- Happy框架版本：         ${this.config.HAPPY_VERSION}
- NODE_ENV:             ${this.config.NODE_ENV}
- NODE_PORT:            ${this.config.NODE_PORT}
- Local:                http://127.0.0.1:${this.config.NODE_PORT}
- On Your Network:      http://${ip.address()}:${this.config.NODE_PORT}`;
                if (process.env.HTTP_PROXY && process.env.HTTPS_PROXY) {
                    msg += `\n- HTTP_PROXY            ${process.env.HTTP_PROXY}`;
                    msg += `\n- HTTPS_PROXY           ${process.env.HTTPS_PROXY}`;
                }
                console.log(boxen(msg, {
                    padding: {
                        left: 2,
                        right: 2,
                        top: 0,
                        bottom: 1
                    },
                    margin: 1,
                    borderColor: 'green',
                    borderStyle: 'classic'
                }));
            } else {
                console.log(`NODE_ENV = ${this.config.NODE_ENV}`);
                console.log(`NODE_PORT = ${this.config.NODE_PORT}`);
            }
        });
    }


}


module.exports = Happy

module.exports.BusinessError = BusinessError
module.exports.ParamsError = ParamsError
module.exports.Exception_404 = Exception_404
module.exports.Validator = Validator
module.exports.validator = new Validator()
module.exports.router = libRouter
module.exports.Controller = Controller
module.exports.Service = Service
module.exports.viewEnv = viewEnv
module.exports.rewrite = rewrite
