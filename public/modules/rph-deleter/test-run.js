const { deleteRPH } = require('./rph-deleter.js');

(async () => {
    console.log("Memulakan test-run.js...");
    try {
        await deleteRPH('Roslan2', '@reeZ860', '10-08-2026 — 14-08-2026', (msg) => {
            console.log(msg);
        });
        console.log("Test-run berjaya tamat!");
    } catch (err) {
        console.error("Ralat:", err);
    }
})();
