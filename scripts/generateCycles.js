import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || process.env.VITE_PB_URL || 'http://127.0.0.1:8091';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const MONTHS = Number.parseInt(process.env.MONTHS || '12', 10);

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD.');
  process.exit(1);
}

const pb = new PocketBase(PB_URL);

async function generateCycles(months = 12) {
  try {
    await pb.collection('users').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('PocketBase admin login succeeded.');
  } catch (err) {
    console.error('PocketBase admin login failed. Check PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD.', err);
    return;
  }

  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < months; i++) {
    const startDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;
    const cycleName = `${year}年${month}月`;

    let existing = null;
    try {
      existing = await pb.collection('month_cycles').getFirstListItem(`name="${cycleName}"`);
    } catch {
      // Missing records are expected for new cycles.
    }

    if (existing) {
      console.log(`Skipped existing cycle: ${cycleName}`);
      skipped++;
      continue;
    }

    const isActive = year === now.getFullYear() && month === now.getMonth() + 1;

    try {
      await pb.collection('month_cycles').create({
        name: cycleName,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        is_active: isActive,
      });
      console.log(`Created cycle: ${cycleName}`);
      created++;
    } catch (err) {
      console.error(`Failed to create cycle ${cycleName}:`, err);
    }
  }

  console.log(`Done. Created ${created}, skipped ${skipped}.`);
}

generateCycles(Number.isFinite(MONTHS) ? MONTHS : 12).catch(console.error);
