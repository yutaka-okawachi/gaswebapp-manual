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
    console.log(`\n${c.bold}${c.brightCyan}[${step}/${total}] ${title}${c.reset}`);
}

function success(message) {
    console.log(`  ${c.brightGreen}✔${c.reset} ${message}`);
}

function info(message) {
    console.log(`  ${c.cyan}ℹ${c.reset} ${message}`);
}

function warn(message) {
    console.log(`  ${c.yellow}⚠${c.reset} ${message}`);
}

function error(message) {
    console.log(`  ${c.red}✖${c.reset} ${message}`);
}

function wait(message) {
    console.log(`  ${c.yellow}⏳${c.reset} ${message}`);
}

function sub(message) {
    console.log(`    ${c.gray}・${c.reset}${message}`);
}

function finish(message) {
    console.log(`\n${c.bold}${c.brightGreen}✨ ${message}${c.reset}\n`);
}

module.exports = { c, header, success, info, warn, error, wait, sub, finish };
