
function getRemainingDays(startDate, days) {
    const expires = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
    
    // Logic 1: Current (Math.ceil)
    function current(now) {
        const diff = expires - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    // Logic 2: Calendar Days (Midnights)
    function calendar(now) {
        const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d2 = new Date(expires.getFullYear(), expires.getMonth(), expires.getDate());
        return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    }

    const testTimes = [
        new Date(startDate.getTime() + 1000), // 1 sec after purchase
        new Date(startDate.getTime() + 20 * 60 * 60 * 1000), // 20 hours after purchase (still same day)
        new Date(startDate.getTime() + 26 * 60 * 60 * 1000), // 26 hours after purchase (next day)
    ];

    console.log("Testing Plan with " + days + " days bought at " + startDate.toLocaleString());
    testTimes.forEach(t => {
        console.log("At " + t.toLocaleString() + ":");
        console.log("  Current: " + current(t));
        console.log("  Calendar: " + calendar(t));
    });
}

const purchase = new Date("2026-05-06T22:05:00");
getRemainingDays(purchase, 10);
