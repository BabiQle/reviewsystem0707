import PocketBase from 'pocketbase';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PB_URL = process.env.PB_URL || process.env.VITE_PB_URL || 'http://127.0.0.1:8091';
const pb = new PocketBase(PB_URL);

const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD.');
  process.exit(1);
}

const EXCEL_FILE = path.join(__dirname, '需求排期&人员占用.xlsx');

async function login() {
  await pb.collection('users').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('登录成功');
}

async function importData() {
  await login();

  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0]; // "人员占用"
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // 获取所有用户映射
  const usersResult = await pb.collection('users').getList(1, 200);
  const userMap = new Map();
  usersResult.items.forEach(user => {
    userMap.set(user.display_name, user.id);
    userMap.set(user.username, user.id);
  });

  // 表头（负责人列表）
  const headers = rows[0];
  // 负责人列从索引4开始（E列）
  const responsiblePersons = [];
  for (let i = 4; i < headers.length; i++) {
    if (headers[i] && headers[i].trim() !== '') {
      responsiblePersons.push({ index: i, name: headers[i].trim() });
    }
  }
  console.log(`负责人列: ${responsiblePersons.map(p => p.name).join(', ')}`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const employeeName = row[1]; // B列 姓名
    if (!employeeName) continue;

    const userId = userMap.get(employeeName);
    if (!userId) {
      console.warn(`未找到用户: ${employeeName}，跳过`);
      continue;
    }

    // 找出该员工在哪一列有项目（取第一个非空且不含“练习”的单元格）
    let project = '';
    let responsiblePerson = '';
    for (const col of responsiblePersons) {
      const cell = row[col.index];
      if (cell && typeof cell === 'string' && !cell.includes('练习')) {
        project = cell;
        responsiblePerson = col.name;
        break;
      }
    }

    // 如果没有项目，但出勤列有“恒昌”，视作项目为“恒昌”，负责人暂空（或保留原逻辑）
    const rawAttendance = row[3] ? row[3].toString().trim() : '';
    if (!project && rawAttendance === '恒昌') {
      project = '恒昌';
      // 负责人可设为“恒昌”或留空，这里留空
      responsiblePerson = '';
    }

    // 出勤状态（用于 attendance 字段）
    let attendance = '正常';
    if (rawAttendance === '请假') attendance = '休假';
    else if (rawAttendance === '恒昌') attendance = '出差';

    try {
      // 检查是否已有记录
      let existing;
      try {
        existing = await pb.collection('user_status').getFirstListItem(`user="${userId}"`);
      } catch (err) {}

      const data = {
        project,
        attendance,
        responsible_person: responsiblePerson,
      };

      if (existing) {
        await pb.collection('user_status').update(existing.id, data);
        console.log(`更新: ${employeeName} -> 项目:${project}, 负责人:${responsiblePerson}`);
      } else {
        // 需要同时设置 user 字段
        await pb.collection('user_status').create({
          user: userId,
          ...data,
        });
        console.log(`创建: ${employeeName} -> 项目:${project}, 负责人:${responsiblePerson}`);
      }
      successCount++;
    } catch (err) {
      console.error(`处理用户 ${employeeName} 失败:`, err.response?.data || err.message);
      failCount++;
    }
  }

  console.log(`导入完成: 成功 ${successCount} 条，失败 ${failCount} 条`);
}

importData().catch(console.error);
