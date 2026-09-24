import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { culturalClasses, events, paataShaaleLevels } from '../src/data/siteData.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const seededClasses = [
  ...paataShaaleLevels.map((item) => ({
    ...item,
    category: 'Language',
    status: 'Online',
    date: 'Sep 13, 2026 - Jun 20, 2027',
    location: 'Virtual Google Classroom'
  })),
  ...culturalClasses
];

function classRow(item) {
  return {
    title: item.title,
    category: item.category,
    status: item.status,
    date: item.date,
    time: item.time,
    age: item.age,
    fee: item.fee,
    location: item.location,
    focus: item.focus || item.instructor || '',
    photo: item.photo || ''
  };
}

function eventRow(item) {
  return {
    month: item.month,
    title: item.title,
    body: item.body,
    location: item.location || '',
    photo: item.photo || ''
  };
}

async function seedTable(table, rows, titleColumn = 'title') {
  for (const row of rows) {
    const { data: existing, error: findError } = await supabase
      .from(table)
      .select('id')
      .eq(titleColumn, row[titleColumn])
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      const { error } = await supabase.from(table).update(row).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).insert(row);
      if (error) throw error;
    }
  }
}

await seedTable('kb_classes', seededClasses.map(classRow));
await seedTable('kb_events', events.map(eventRow));
await supabase
  .from('kb_admins')
  .upsert({
    email: process.env.ADMIN_EMAIL || 'test@gmail.com',
    name: 'Kannada Bharati Admin',
    active: true
  }, { onConflict: 'email' });

console.log(`Seeded ${seededClasses.length} classes and ${events.length} events into Supabase.`);
