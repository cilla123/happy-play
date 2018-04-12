const nodemon = require('nodemon');
const path = require('path');
const chalk = require('chalk');

const config = {
    verbose: false,
    env: {
        NODE_ENV: 'development'
    },
    watch: [
        path.join(__dirname, 'server/**/*.*')
    ],
    ignore: [],
    script: path.join(__dirname, 'server/babel.app.js')
};

nodemon(config).on('start', () => {
    console.log(chalk.green('应用启动中...'));
}).on('quit', () => {
    console.log(chalk.green('✔ 应用退出成功'));
}).on('restart', (files) => {
    console.log(chalk.green('监听到文件修改：', files));
});