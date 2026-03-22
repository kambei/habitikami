import fetch from 'node-fetch';
import 'dotenv/config';

async function testExport() {
    const url = 'http://localhost/api/export';
    const token = process.env.EXPORT_API_TOKEN;

    if (!token) {
        console.error("Set EXPORT_API_TOKEN in .env");
        return;
    }

    try {
        const res = await fetch(url, { headers: { 'x-api-token': token } });
        const data = await res.json();

        console.log("Counters count:", data.counters ? data.counters.length : 0);
        if (data.counters && data.counters.length > 0) {
            console.log("Last 2 counters:", data.counters.slice(-2));
        } else {
            console.log("No counters returned!");
        }
    } catch (e) {
        console.error(e);
    }
}

testExport();
