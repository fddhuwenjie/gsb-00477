import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database;
let promoteWaitlist: (equipment_id: number, reserve_date: string, time_slot: string) => { promoted: boolean; entry?: any; reason?: string };

function setupTestDb() {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS labs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','tutor','admin')),
      email TEXT,
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      lab_id INTEGER NOT NULL REFERENCES labs(id),
      manager_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'normal' CHECK(status IN ('normal','repairing','scrapped')),
      purchase_no TEXT,
      unit_price DECIMAL(10,2),
      purchase_date DATE,
      category TEXT NOT NULL CHECK(category IN ('analyzer','optical','electronic','chemical','computing')),
      photo_url TEXT,
      precautions TEXT
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      student_id INTEGER NOT NULL REFERENCES users(id),
      tutor_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER,
      reserve_date DATE NOT NULL,
      time_slot TEXT NOT NULL CHECK(time_slot IN ('morning','afternoon','evening')),
      purpose TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','completed','cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      student_id INTEGER NOT NULL REFERENCES users(id),
      reserve_date DATE NOT NULL,
      time_slot TEXT NOT NULL CHECK(time_slot IN ('morning','afternoon','evening')),
      purpose TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','promoted','cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      promoted_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      promoted_reservation_id INTEGER REFERENCES reservations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_waitlist_equipment ON waitlist(equipment_id, reserve_date, time_slot, status);
    CREATE INDEX IF NOT EXISTS idx_reservations_equipment ON reservations(equipment_id, reserve_date, time_slot);
  `);

  promoteWaitlist = (equipment_id: number, reserve_date: string, time_slot: string) => {
    const slotTaken = db.prepare(`SELECT id FROM reservations
      WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status IN ('pending', 'approved')`).get(
      equipment_id, reserve_date, time_slot
    );

    if (slotTaken) {
      return { promoted: false, reason: 'slot_still_occupied' };
    }

    const entry: any = db.prepare(`SELECT * FROM waitlist
      WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting'
      ORDER BY created_at ASC, id ASC LIMIT 1`).get(equipment_id, reserve_date, time_slot);

    if (!entry) {
      return { promoted: false, reason: 'no_waiting_entries' };
    }

    const updateResult = db.prepare("UPDATE waitlist SET status = 'promoted', promoted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(entry.id);

    if (updateResult.changes === 0) {
      return { promoted: false, reason: 'race_condition_already_processed' };
    }

    const equipment: any = db.prepare('SELECT manager_id FROM equipment WHERE id = ?').get(equipment_id);
    const tutor_id = equipment?.manager_id || 1;

    const insertResult = db.prepare(`INSERT INTO reservations
      (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'), datetime('now'))`).run(
      entry.equipment_id, entry.student_id, tutor_id, entry.reserve_date, entry.time_slot, entry.purpose
    );

    db.prepare('UPDATE waitlist SET promoted_reservation_id = ? WHERE id = ?').run(insertResult.lastInsertRowid, entry.id);

    const promotedEntry = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(entry.id);

    return { promoted: true, entry: promotedEntry };
  };

  const insertLab = db.prepare('INSERT INTO labs (name, location, description) VALUES (?, ?, ?)');
  const labId = insertLab.run('测试实验室', '测试地址', '测试描述').lastInsertRowid as number;

  const insertUser = db.prepare('INSERT INTO users (username, password, name, role, email, phone) VALUES (?, ?, ?, ?, ?, ?)');
  const tutorId = insertUser.run('tutor_test', 'test123', '测试导师', 'tutor', 'tutor@test.com', '13800000000').lastInsertRowid as number;
  const student1Id = insertUser.run('student1', 'test123', '学生1', 'student', 's1@test.com', '13900000001').lastInsertRowid as number;
  const student2Id = insertUser.run('student2', 'test123', '学生2', 'student', 's2@test.com', '13900000002').lastInsertRowid as number;
  const student3Id = insertUser.run('student3', 'test123', '学生3', 'student', 's3@test.com', '13900000003').lastInsertRowid as number;

  const insertEquipment = db.prepare('INSERT INTO equipment (name, model, lab_id, manager_id, status, category) VALUES (?, ?, ?, ?, ?, ?)');
  const eq1Id = insertEquipment.run('测试设备A', 'Model-A', labId, tutorId, 'normal', 'analyzer').lastInsertRowid as number;

  return { labId, tutorId, student1Id, student2Id, student3Id, eq1Id };
}

let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ ${message}`);
  } else {
    failCount++;
    console.log(`  ✗ ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  testCount++;
  if (actual === expected) {
    passCount++;
    console.log(`  ✓ ${message} (${actual})`);
  } else {
    failCount++;
    console.log(`  ✗ ${message}`);
    console.log(`    Expected: ${expected}`);
    console.log(`    Actual:   ${actual}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name: string, fn: () => void) {
  console.log(`\n${name}`);
  try {
    fn();
  } catch (err: any) {
    console.log(`    Error: ${err.message}`);
  }
}

console.log('='.repeat(60));
console.log('Waitlist Promotion & Idempotency Tests');
console.log('='.repeat(60));

const ids = setupTestDb();
const { eq1Id, tutorId, student1Id, student2Id, student3Id } = ids;
const testDate = '2026-07-01';
const testSlot = 'morning';

test('1. Basic promotion: first waitlist entry becomes reservation', () => {
  const reservationId = db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
    eq1Id, student1Id, tutorId, testDate, testSlot, '初始预约测试'
  ).lastInsertRowid as number;

  const waitlistId = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
    eq1Id, student2Id, testDate, testSlot, '候补测试1'
  ).lastInsertRowid as number;

  const beforeWaitlist = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId) as any;
  assertEqual(beforeWaitlist.status, 'waiting', 'Waitlist entry starts as waiting');

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservationId);

  const result = promoteWaitlist(eq1Id, testDate, testSlot);

  assert(result.promoted === true, 'promoteWaitlist returns promoted: true');
  assert(result.entry !== undefined, 'promoteWaitlist returns entry');
  assert(result.reason === undefined, 'No reason on success');

  const afterWaitlist = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId) as any;
  assertEqual(afterWaitlist.status, 'promoted', 'Waitlist status changed to promoted');
  assert(afterWaitlist.promoted_at !== null, 'promoted_at is set');
  assert(afterWaitlist.updated_at !== null, 'updated_at is set');
  assert(afterWaitlist.promoted_reservation_id !== null, 'promoted_reservation_id is set');

  const newReservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(afterWaitlist.promoted_reservation_id) as any;
  assert(newReservation !== undefined, 'New reservation was created');
  assertEqual(newReservation.status, 'approved', 'New reservation is approved');
  assertEqual(newReservation.student_id, student2Id, 'New reservation belongs to waitlist student');
  assertEqual(newReservation.equipment_id, eq1Id, 'New reservation is for same equipment');
  assertEqual(newReservation.time_slot, testSlot, 'New reservation is for same time slot');
  assertEqual(newReservation.reserve_date, testDate, 'New reservation is for same date');
});

test('2. Idempotency: calling promoteWaitlist twice does not create duplicate reservations', () => {
  const testDate2 = '2026-07-02';
  const testSlot2 = 'afternoon';

  const reservationId = db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
    eq1Id, student1Id, tutorId, testDate2, testSlot2, '幂等性测试预约'
  ).lastInsertRowid as number;

  const waitlistId = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
    eq1Id, student2Id, testDate2, testSlot2, '幂等性候补'
  ).lastInsertRowid as number;

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservationId);

  const result1 = promoteWaitlist(eq1Id, testDate2, testSlot2);
  assert(result1.promoted === true, 'First call promotes successfully');

  const resCountBefore = db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(eq1Id, testDate2, testSlot2, 'approved') as any;

  const result2 = promoteWaitlist(eq1Id, testDate2, testSlot2);
  assert(result2.promoted === false, 'Second call does not promote');
  assert(result2.reason === 'slot_still_occupied' || result2.reason === 'no_waiting_entries', 'Second call returns non-promotion reason');

  const resCountAfter = db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(eq1Id, testDate2, testSlot2, 'approved') as any;

  assertEqual(resCountAfter.cnt, resCountBefore.cnt, 'No duplicate reservation created');

  const waitlistEntry = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId) as any;
  assertEqual(waitlistEntry.status, 'promoted', 'Waitlist still has promoted status');
});

test('3. No promotion when slot is still occupied', () => {
  const testDate3 = '2026-07-03';
  const testSlot3 = 'evening';

  db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
    eq1Id, student1Id, tutorId, testDate3, testSlot3, '占用测试预约'
  );

  db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
    eq1Id, student2Id, testDate3, testSlot3, '占用测试候补'
  );

  const result = promoteWaitlist(eq1Id, testDate3, testSlot3);
  assert(result.promoted === false, 'Does not promote when slot is occupied');
  assertEqual(result.reason, 'slot_still_occupied', 'Returns slot_still_occupied reason');

  const waitingCount = db.prepare("SELECT COUNT(*) as cnt FROM waitlist WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting'").get(eq1Id, testDate3, testSlot3) as any;
  assertEqual(waitingCount.cnt, 1, 'Waitlist entry remains waiting');
});

test('4. No promotion when no waitlist entries exist', () => {
  const testDate4 = '2026-07-04';
  const testSlot4 = 'morning';

  const result = promoteWaitlist(eq1Id, testDate4, testSlot4);
  assert(result.promoted === false, 'Does not promote with no waitlist');
  assertEqual(result.reason, 'no_waiting_entries', 'Returns no_waiting_entries reason');
});

test('5. FIFO order: first entry in waitlist gets promoted first', () => {
  const testDate5 = '2026-07-05';
  const testSlot5 = 'afternoon';

  const reservationId = db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
    eq1Id, student1Id, tutorId, testDate5, testSlot5, 'FIFO测试预约'
  ).lastInsertRowid as number;

  const w1Id = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now', '-10 minutes'), datetime('now'))`).run(
    eq1Id, student2Id, testDate5, testSlot5, '第一个排队'
  ).lastInsertRowid as number;

  const w2Id = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now', '-5 minutes'), datetime('now'))`).run(
    eq1Id, student3Id, testDate5, testSlot5, '第二个排队'
  ).lastInsertRowid as number;

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservationId);

  const result = promoteWaitlist(eq1Id, testDate5, testSlot5);
  assert(result.promoted === true, 'Promotion succeeded');

  const w1After = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(w1Id) as any;
  const w2After = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(w2Id) as any;

  assertEqual(w1After.status, 'promoted', 'First waitlist entry (earlier) is promoted');
  assertEqual(w2After.status, 'waiting', 'Second waitlist entry (later) remains waiting');

  const promotedReservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(w1After.promoted_reservation_id) as any;
  assertEqual(promotedReservation.student_id, student2Id, 'Promoted reservation belongs to first student in queue');
});

test('6. Reservation cancellation idempotency: cancelling already cancelled reservation is safe', () => {
  const testDate6 = '2026-07-06';
  const testSlot6 = 'evening';

  const reservationId = db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
    eq1Id, student1Id, tutorId, testDate6, testSlot6, '取消幂等性测试'
  ).lastInsertRowid as number;

  const w1Id = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
    eq1Id, student2Id, testDate6, testSlot6, '取消幂等性候补'
  ).lastInsertRowid as number;

  const cancelResult1 = db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ? AND status != 'cancelled'").run(reservationId);
  assertEqual(cancelResult1.changes, 1, 'First cancellation changes 1 row');

  if (cancelResult1.changes > 0) {
    promoteWaitlist(eq1Id, testDate6, testSlot6);
  }

  const w1AfterFirst = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(w1Id) as any;
  assertEqual(w1AfterFirst.status, 'promoted', 'Waitlist promoted after first cancel');

  const cancelResult2 = db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ? AND status != 'cancelled'").run(reservationId);
  assertEqual(cancelResult2.changes, 0, 'Second cancellation changes 0 rows (idempotent)');

  if (cancelResult2.changes > 0) {
    promoteWaitlist(eq1Id, testDate6, testSlot6);
  }

  const approvedResCount = db.prepare("SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'approved'").get(eq1Id, testDate6, testSlot6) as any;
  assertEqual(approvedResCount.cnt, 1, 'Only 1 approved reservation exists (no duplicate from double cancel)');
});

test('7. Waitlist cancellation idempotency: cancelling already cancelled waitlist is safe', () => {
  const testDate7 = '2026-07-07';
  const testSlot7 = 'morning';

  const wId = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
    eq1Id, student1Id, testDate7, testSlot7, '候补取消幂等性'
  ).lastInsertRowid as number;

  const before = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(wId) as any;
  assertEqual(before.status, 'waiting', 'Starts as waiting');

  const cancel1 = db.prepare("UPDATE waitlist SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(wId);
  assertEqual(cancel1.changes, 1, 'First waitlist cancel changes 1 row');

  const after1 = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(wId) as any;
  assertEqual(after1.status, 'cancelled', 'Status is cancelled after first cancel');

  const cancel2 = db.prepare("UPDATE waitlist SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(wId);
  assertEqual(cancel2.changes, 0, 'Second waitlist cancel changes 0 rows (idempotent)');
});

test('8. Cannot cancel a promoted waitlist entry', () => {
  const testDate8 = '2026-07-08';
  const testSlot8 = 'afternoon';

  const reservationId = db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
    eq1Id, student1Id, tutorId, testDate8, testSlot8, '已递补取消测试'
  ).lastInsertRowid as number;

  const wId = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
    eq1Id, student2Id, testDate8, testSlot8, '已递补取消测试候补'
  ).lastInsertRowid as number;

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservationId);
  promoteWaitlist(eq1Id, testDate8, testSlot8);

  const wAfterPromote = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(wId) as any;
  assertEqual(wAfterPromote.status, 'promoted', 'Waitlist is promoted');

  const cancelResult = db.prepare("UPDATE waitlist SET status = 'cancelled' WHERE id = ? AND status = 'waiting'").run(wId);
  assertEqual(cancelResult.changes, 0, 'Cannot cancel promoted waitlist entry (0 rows changed)');

  const wFinal = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(wId) as any;
  assertEqual(wFinal.status, 'promoted', 'Status remains promoted');
});

test('9. updated_at changes on status transition', () => {
  const testDate9 = '2026-07-09';
  const testSlot9 = 'evening';

  const wId = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now', '-1 hour'), datetime('now', '-1 hour'))`).run(
    eq1Id, student1Id, testDate9, testSlot9, 'updated_at测试'
  ).lastInsertRowid as number;

  const before = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(wId) as any;
  const beforeUpdatedAt = before.updated_at;

  db.prepare("UPDATE waitlist SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(wId);

  const after = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(wId) as any;
  assert(after.updated_at !== beforeUpdatedAt, 'updated_at changes after status update');
  assertEqual(after.status, 'cancelled', 'Status changed to cancelled');
});

test('10. promoted_reservation_id links to the correct reservation', () => {
  const testDate10 = '2026-07-10';
  const testSlot10 = 'morning';

  const reservationId = db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
    eq1Id, student1Id, tutorId, testDate10, testSlot10, '关联测试预约'
  ).lastInsertRowid as number;

  const wId = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
    eq1Id, student2Id, testDate10, testSlot10, '关联测试候补'
  ).lastInsertRowid as number;

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservationId);

  const result = promoteWaitlist(eq1Id, testDate10, testSlot10);
  assert(result.promoted === true, 'Promotion succeeded');

  const waitlistAfter = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(wId) as any;
  const reservationAfter = db.prepare('SELECT * FROM reservations WHERE id = ?').get(waitlistAfter.promoted_reservation_id) as any;

  assert(reservationAfter !== undefined, 'Linked reservation exists');
  assertEqual(reservationAfter.id, waitlistAfter.promoted_reservation_id, 'IDs match');
  assertEqual(reservationAfter.student_id, student2Id, 'Reservation belongs to waitlist student');
  assertEqual(reservationAfter.purpose, '关联测试候补', 'Reservation purpose matches waitlist purpose');
});

console.log('\n' + '='.repeat(60));
console.log(`Test Results: ${passCount}/${testCount} passed, ${failCount} failed`);
console.log('='.repeat(60));

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\nAll tests passed! 🎉');
  process.exit(0);
}
