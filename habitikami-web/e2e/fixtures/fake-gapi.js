// In-memory stand-in for https://apis.google.com/js/api.js used by the e2e
// tests: a tiny Sheets API over a few sheets kept in memory. The tests read
// and seed it through window.__fakeSheets.
(function () {
  const pad = n => (n < 10 ? '0' + n : String(n));
  const DAYS_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const today = new Date();
  const dateStr = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  const weekdays = [['Giorno', 'Date', 'Run', 'Read', 'Water']];
  const weekend = [['Giorno', 'Date', 'Run', 'Read', 'Water']];
  // Every day of the current month up to today; today's row has nothing done yet
  for (let day = 1; day <= today.getDate(); day++) {
    const d = new Date(today.getFullYear(), today.getMonth(), day);
    const isToday = day === today.getDate();
    const row = [DAYS_IT[d.getDay()], dateStr(d), isToday ? 'FALSE' : (day % 2 ? 'TRUE' : 'FALSE'), isToday ? 'FALSE' : 'TRUE', isToday ? '' : String(day % 9)];
    (d.getDay() === 0 || d.getDay() === 6 ? weekend : weekdays).push(row);
  }
  const sheets = {
    Weekdays: weekdays,
    Weekend: weekend,
    HabitMeta: [['Habit', 'Description', 'Type', 'Target', 'Unit', 'Slot', 'Time'], ['Water', 'Eight glasses', 'number', '8', 'glasses', 'morning', ''], ['Run', 'Morning run', 'check', '', '', 'morning', '07:30']],
    Counters: [['Date', 'smoke', 'smoked'], [today.toISOString().slice(0, 10), '2', '0']],
    MobNotes: [['Date', 'Content', 'Links']],
    Training: [['Date', 'Section', 'Exercise', 'Session', 'Duration']],
  };
  const colors = { Run: { red: 0.95, green: 0.4, blue: 0.4 }, Read: { red: 0.4, green: 0.6, blue: 0.95 }, Water: { red: 0.4, green: 0.85, blue: 0.7 } };
  const calls = [];

  function parseRange(range) {
    const [sheetName, a1] = String(range).split('!');
    if (!sheets[sheetName]) { const e = new Error('Unable to parse range: ' + range); e.status = 400; e.result = { error: { message: 'Unable to parse range: ' + range } }; throw e; }
    const col = s => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    let c1 = 0, r1 = 0, c2 = 25, r2 = Infinity;
    if (a1) {
      const [p1, p2] = a1.split(':');
      const m1 = p1.match(/^([A-Z]+)(\d*)$/); if (m1) { c1 = col(m1[1]); r1 = m1[2] ? +m1[2] - 1 : 0; }
      if (p2) { const m2 = p2.match(/^([A-Z]+)(\d*)$/); if (m2) { c2 = col(m2[1]); r2 = m2[2] ? +m2[2] - 1 : Infinity; } } else if (m1 && m1[2]) { c2 = c1; r2 = r1; }
    }
    return { sheetName, c1, r1, c2, r2 };
  }
  function getValues(range) {
    const { sheetName, c1, r1, c2, r2 } = parseRange(range);
    const rows = sheets[sheetName].slice(r1, r2 === Infinity ? undefined : r2 + 1).map(r => r.slice(c1, c2 + 1));
    while (rows.length && rows[rows.length - 1].every(v => v === '' || v === undefined)) rows.pop();
    return rows.length ? rows : undefined;
  }
  function putValues(range, values) {
    const { sheetName, c1, r1 } = parseRange(range);
    const grid = sheets[sheetName];
    values.forEach((row, i) => {
      while (grid.length <= r1 + i) grid.push([]);
      row.forEach((v, j) => { grid[r1 + i][c1 + j] = typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v; });
    });
  }
  const ok = result => Promise.resolve({ result, status: 200 });

  const client = {
    init: () => Promise.resolve(),
    setToken: () => {},
    sheets: { spreadsheets: {
      values: {
        get: ({ range }) => { calls.push(['get', range]); try { return ok({ values: getValues(range) }); } catch (e) { return Promise.reject(e); } },
        batchGet: ({ ranges }) => ok({ valueRanges: ranges.map(r => ({ range: r, values: (() => { try { return getValues(r); } catch { return undefined; } })() })) }),
        update: ({ range, resource }) => { calls.push(['update', range, resource.values]); putValues(range, resource.values); return ok({ updatedCells: 1 }); },
        append: ({ range, resource }) => { const { sheetName } = parseRange(range); calls.push(['append', range, resource.values]); sheets[sheetName].push(...resource.values.map(r => r.map(v => (typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v)))); return ok({}); },
        clear: ({ range }) => { const { sheetName } = parseRange(range); sheets[sheetName] = sheets[sheetName].slice(0, 1); return ok({}); },
      },
      get: ({ ranges, includeGridData }) => {
        const list = Object.keys(sheets).map((title, i) => ({ properties: { title, sheetId: i + 1 } }));
        if (!includeGridData) return ok({ sheets: list });
        const { sheetName } = parseRange(ranges[0]);
        const rowData = sheets[sheetName].slice(0, 5).map(r => ({ values: r.map(v => ({ formattedValue: String(v ?? ''), userEnteredValue: { stringValue: String(v ?? '') }, userEnteredFormat: colors[v] ? { backgroundColor: colors[v] } : undefined })) }));
        return ok({ sheets: [{ properties: { title: sheetName, sheetId: 1 }, data: [{ rowData }] }] });
      },
      batchUpdate: ({ resource }) => {
        for (const req of resource.requests || []) {
          if (req.addSheet) sheets[req.addSheet.properties.title] = [];
          if (req.deleteDimension) { /* ignored */ }
        }
        return ok({});
      },
      create: () => ok({ spreadsheetId: 'new-sheet' }),
    } },
    drive: { files: { list: () => ok({ files: [] }) } },
  };

  window.gapi = { load: (_name, cb) => setTimeout(cb, 0), client };
  window.__fakeSheets = { sheets, calls, today: dateStr(today) };
})();
