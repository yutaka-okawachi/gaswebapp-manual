const timing = require('./timing');
const isColorSupported = process.stdout.isTTY !== false && !process.env.NO_COLOR;

const c = {
    reset: isColorSupported ? '\x1b[0m' : '',
    bold: isColorSupported ? '\x1b[1m' : '',
    dim: isColorSupported ? '\x1b[2m' : '',
    green: isColorSupported ? '\x1b[32m' : '',
    brightGreen: isColorSupported ? '\x1b[92m' : '',
    cyan: isColorSupported ? '\x1b[36m' : '',
    brightCyan: isColorSupported ? '\x1b[96m' : '',
    yellow: isColorSupported ? '\x1b[33m' : '',
    red: isColorSupported ? '\x1b[31m' : '',
    blue: isColorSupported ? '\x1b[34m' : '',
    magenta: isColorSupported ? '\x1b[35m' : '',
    gray: isColorSupported ? '\x1b[90m' : ''
};

function header(step, total, title) {
    timing.stage(step);
    console.log(`\n${c.bold}${c.brightCyan}[${step}/${total}] ${title}${c.reset}`);
}

function success(message) {
    console.log(`  ${c.brightGreen}✔ [完了]${c.reset} ${message}`);
}

function info(message) {
    console.log(`  ${c.cyan}ℹ [案内]${c.reset} ${message}`);
}

function warn(message) {
    console.log(`  ${c.yellow}⚠ [注意]${c.reset} ${message}`);
}

function error(message) {
    console.log(`  ${c.red}✖ [失敗]${c.reset} ${message}`);
}

function wait(message) {
    console.log(`  ${c.yellow}⏳ [待機中]${c.reset} ${message}`);
}

function sub(message) {
    console.log(`    ${c.gray}・[完了]${c.reset} ${message}`);
}

function finish(message) {
    console.log(`\n${c.bold}${c.brightGreen}✨ [完了] ${message}${c.reset}\n`);
}

module.exports = { c, header, success, info, warn, error, wait, sub, finish };
