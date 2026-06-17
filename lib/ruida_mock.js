// Simple mock Ruida connector for development and testing
// Exports sendJob(job, progressCallback) -> Promise

export default {
    sendJob: (job, progressCallback) => {
        return new Promise((resolve, reject) => {
            // Simulate time to process based on image size param or fixed
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.floor(Math.random() * 15) + 5; // +5..20
                if (progress > 100) progress = 100;
                try { progressCallback(progress); } catch (e) { /* ignore */ }
                if (progress >= 100) {
                    clearInterval(interval);
                    // Randomly fail at small probability to test error path
                    if (Math.random() < 0.02) {
                        return reject(new Error('Simulated Ruida transmission error'));
                    }
                    return resolve();
                }
            }, 500);
        });
    }
};
