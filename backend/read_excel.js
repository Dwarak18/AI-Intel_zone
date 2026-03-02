const XLSX = require('xlsx');
const wb = XLSX.readFile('../TEAMS-DATA.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });

const teams = {};
let lastId = null;

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const teamId = String(row[0] || '').trim();
  const teamName = String(row[1] || '').trim();
  const pass = String(row[2] || '').trim();
  const memberName = String(row[3] || '').trim();

  if (teamId) {
    lastId = teamId;
    if (!teams[lastId]) {
      teams[lastId] = { id: lastId, name: teamName, pass: pass, members: [] };
    }
  }
  if (lastId && memberName && teams[lastId]) {
    teams[lastId].members.push(memberName);
  }
}

const tList = Object.values(teams);
console.log('Unique teams:', tList.length);
tList.forEach(t => console.log(JSON.stringify(t)));
