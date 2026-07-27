document.addEventListener('DOMContentLoaded', async () => {
    // Get the electronAPI from the parent window (since we are in an iframe)
    const api = window.electronAPI || window.parent.electronAPI;
    
    if (!api) {
        console.error("Electron API not found");
        return;
    }

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const geminiInput = document.getElementById('gemini-api');
    const deepseekInput = document.getElementById('deepseek-api');
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('save-status');

    // Load existing settings
    try {
        const settings = await api.getSettings();
        if (settings) {
            usernameInput.value = settings.username || '';
            // If encrypted, we might need to decrypt it first
            // But since settings API returns raw saved data, we just display it
            if (settings.password) {
                const decryptedPass = await api.decryptData(settings.password);
                passwordInput.value = decryptedPass || '';
            }
            if (settings.apiKey) {
                const decryptedApi = await api.decryptData(settings.apiKey);
                geminiInput.value = decryptedApi || '';
            }
            if (settings.deepseekApiKey) {
                const decryptedDs = await api.decryptData(settings.deepseekApiKey);
                deepseekInput.value = decryptedDs || '';
            }
        }
    } catch (e) {
        console.error('Failed to load settings', e);
    }

    // Save settings
    saveBtn.addEventListener('click', async () => {
        statusMsg.textContent = 'Menyimpan...';
        statusMsg.className = 'status-msg';

        try {
            const username = usernameInput.value.trim();
            const passwordRaw = passwordInput.value;
            const geminiRaw = geminiInput.value.trim();
            const deepseekRaw = deepseekInput.value.trim();

            const encryptedPassword = await api.encryptData(passwordRaw);
            const encryptedGemini = await api.encryptData(geminiRaw);
            const encryptedDeepseek = await api.encryptData(deepseekRaw);

            const result = await api.saveSettings({
                username: username,
                password: encryptedPassword,
                apiKey: encryptedGemini,
                deepseekApiKey: encryptedDeepseek
            });

            if (result.success) {
                statusMsg.textContent = 'Tetapan berjaya disimpan!';
                statusMsg.className = 'status-msg success';
                setTimeout(() => { statusMsg.textContent = ''; }, 3000);
            } else {
                throw new Error(result.error);
            }
        } catch (e) {
            statusMsg.textContent = 'Gagal menyimpan tetapan.';
            statusMsg.className = 'status-msg error';
            console.error(e);
        }
    });
});
