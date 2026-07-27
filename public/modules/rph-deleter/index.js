const { deleteRPH } = require('./rph-deleter.js');

async function runDeletion(config, logCallback) {
    const { username, password, miwDate } = config;
    try {
        await deleteRPH(username, password, miwDate, logCallback);
    } catch (err) {
        logCallback(`Gagal: ${err.message}`);
    }
}

module.exports = { runDeletion };
