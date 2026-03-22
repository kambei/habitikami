
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const getSheetsClient = async () => {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !privateKey) {
        throw new Error("Missing Google Service Account credentials.");
    }

    const auth = new google.auth.JWT(
        email,
        undefined,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    return google.sheets({ version: 'v4', auth });
};

const run = async () => {
    try {
        const spreadsheetId = process.env.VITE_SPREADSHEET_ID;
        console.log(`Checking Spreadsheet: ${spreadsheetId}`);

        const sheets = await getSheetsClient();

        const ranges = ['Weekdays!A1:Z5', 'Weekend!A1:Z5'];
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges,
        });

        const valueRanges = response.data.valueRanges;

        valueRanges.forEach(rangeData => {
            console.log(`\n--- Sheet Content: ${rangeData.range} ---`);
            if (rangeData.values) {
                rangeData.values.forEach((row, i) => {
                    console.log(`Row ${i}:`, JSON.stringify(row));
                });
            } else {
                console.log("No data found.");
            }
        });

    } catch (error) {
        console.error("Error:", error);
    }
};

run();
