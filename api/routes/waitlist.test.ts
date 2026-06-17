import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDbPath = path.join(__dirname, '..', '..', 'data', 'test_waitlist.db');

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new Database(testDbPath);
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

  CREATE TABLE IF NOT EXISTS trainings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS training_qualifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    training_id INTEGER NOT NULL REFERENCES trainings(id),
    category TEXT NOT NULL,
    passed_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    is_valid INTEGER DEFAULT 1
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
    approved_at DATETIME,
    waitlist_id INTEGER REFERENCES waitlist(id)
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER REFERENCES reservations(id),
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    checkin_time DATETIME NOT NULL,
    checkout_time DATETIME,
    experiment_content TEXT,
    equipment_status TEXT,
    has_anomaly INTEGER DEFAULT 0,
    sample_count INTEGER DEFAULT 0
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
    cancelled_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_waitlist_equipment ON waitlist(equipment_id, reserve_date, time_slot, status);
  CREATE INDEX IF NOT EXISTS idx_waitlist_student ON waitlist(student_id);
`);

const insertLab = db.prepare('INSERT INTO labs (name, location, description) VALUES (?, ?, ?)');
const labId = insertLab.run('测试实验室', '测试地址', '测试描述').lastInsertRowid;

const insertUser = db.prepare('INSERT INTO users (username, password, name, role, email, phone) VALUES (?, ?, ?, ?, ?, ?)');
const tutorId = insertUser.run('tutor_test', 'test123', '测试导师', 'tutor', 'tutor@test.com', '13800000000').lastInsertRowid;
const student1Id = insertUser.run('student1', 'test123', '学生一', 'student', 's1@test.com', '13900000001').lastInsertRowid;
const student2Id = insertUser.run('student2', 'test123', '学生二', 'student', 's2@test.com', '13900000002').lastInsertRowid;
const student3Id = insertUser.run('student3', 'test123', '学生三', 'student', 's3@test.com', '13900000003').lastInsertRowid;

const insertEquipment = db.prepare(`INSERT INTO equipment 
  (name, model, lab_id, manager_id, status, category) 
  VALUES (?, ?, ?, ?, 'normal', 'analyzer')`);
const equipmentId = insertEquipment.run('测试设备', 'Test-001', labId, tutorId).lastInsertRowid;

const insertTraining = db.prepare('INSERT INTO trainings (name, content, category) VALUES (?, ?, ?)');
const trainingId = insertTraining.run('测试培训', '测试内容', 'analyzer').lastInsertRowid;

const insertQual = db.prepare('INSERT INTO training_qualifications (user_id, training_id, category, passed_date, expiry_date, is_valid) VALUES (?, ?, ?, date(\'now\'), date(\'now\', \'+1 year\'), 1)');
insertQual.run(student1Id, trainingId, 'analyzer');
insertQual.run(student2Id, trainingId, 'analyzer');
insertQual.run(student3Id, trainingId, 'analyzer');

const insertReservation = db.prepare(`INSERT INTO reservations 
  (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at) 
  VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`);

const insertWaitlist = db.prepare(`INSERT INTO waitlist 
  (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at) 
  VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`);

const testDate = '2025-01-15';
const timeSlot = 'morning';

function promoteWaitlist(equipment_id: number, reserve_date: string, time_slot: string): any {
  const slotTaken = db.prepare(`SELECT id FROM reservations
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ?
    AND status IN ('pending', 'approved')`).get(equipment_id, reserve_date, time_slot);
  if (slotTaken) return null;

  const entry: any = db.prepare(`SELECT * FROM waitlist
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting'
    ORDER BY created_at ASC, id ASC LIMIT 1`).get(equipment_id, reserve_date, time_slot);

  if (!entry) return null;

  const existingReservation = db.prepare(`SELECT id FROM reservations WHERE waitlist_id = ?`).get(entry.id);
  if (existingReservation) {
    return db.prepare('SELECT * FROM waitlist WHERE id = ?').get(entry.id);
  }

  const updateResult = db.prepare("UPDATE waitlist SET status = 'promoted', promoted_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(entry.id);
  if (updateResult.changes === 0) {
    return null;
  }

  const equipment: any = db.prepare('SELECT manager_id FROM equipment WHERE id = ?').get(equipment_id);
  const tutor_id = equipment?.manager_id || 1;

  db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at, waitlist_id)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'), ?)`).run(
    entry.equipment_id, entry.student_id, tutor_id, entry.reserve_date, entry.time_slot, entry.purpose, entry.id
  );

  return db.prepare('SELECT * FROM waitlist WHERE id = ?').get(entry.id);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function testSuite(name: string, fn: () => void): void {
  console.log(`\n${name}`);
  console.log('-'.repeat(50));
  fn();
}

testSuite('测试 1: 基本递补逻辑', () => {
  const reservationId = insertReservation.run(equipmentId, student1Id, tutorId, testDate, timeSlot, '测试预约').lastInsertRowid;
  const waitlist1Id = insertWaitlist.run(equipmentId, student2Id, testDate, timeSlot, '候补1').lastInsertRowid;
  const waitlist2Id = insertWaitlist.run(equipmentId, student3Id, testDate, timeSlot, '候补2').lastInsertRowid;

  const beforeCount = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(equipmentId, testDate, timeSlot, 'approved') as any).cnt;
  assert(beforeCount === 1, '递补前应有 1 个有效预约');

  const waitlistBefore = db.prepare("SELECT * FROM waitlist WHERE status = 'waiting' AND equipment_id = ? AND reserve_date = ? AND time_slot = ? ORDER BY id ASC").all(equipmentId, testDate, timeSlot);
  assert(waitlistBefore.length === 2, '递补前应有 2 人排队');
  assert((waitlistBefore[0] as any).student_id === student2Id, '第一位排队的是学生二');

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservationId);
  const promoted = promoteWaitlist(Number(equipmentId), testDate, timeSlot);

  assert(promoted !== null, '递补应成功返回结果');
  assert(promoted.status === 'promoted', '递补后排队状态应为 promoted');
  assert(promoted.student_id === student2Id, '应递补第一位排队的学生二');
  assert(promoted.promoted_at !== null, '应设置 promoted_at 时间');

  const afterCount = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(equipmentId, testDate, timeSlot, 'approved') as any).cnt;
  assert(afterCount === 1, '递补后仍应有 1 个有效预约');

  const newReservation = db.prepare('SELECT * FROM reservations WHERE waitlist_id = ?').get(waitlist1Id);
  assert(newReservation !== undefined, '新预约应有关联的 waitlist_id');
  assert((newReservation as any).student_id === student2Id, '新预约的学生应为学生二');
  assert((newReservation as any).status === 'approved', '新预约状态应为 approved');

  const remainingWaitlist = db.prepare("SELECT id FROM waitlist WHERE status = 'waiting' AND equipment_id = ? AND reserve_date = ? AND time_slot = ?").all(equipmentId, testDate, timeSlot);
  assert(remainingWaitlist.length === 1, '递补后应剩余 1 人排队');
  assert((remainingWaitlist[0] as any).id === waitlist2Id, '剩余的应是第二位排队的学生三');
});

testSuite('测试 2: 递补幂等性 - 重复调用 promoteWaitlist 不产生重复预约', () => {
  const testDate2b = '2025-01-16';
  const reservationId = insertReservation.run(equipmentId, student1Id, tutorId, testDate2b, 'afternoon', '测试预约2b').lastInsertRowid;
  const waitlistId = insertWaitlist.run(equipmentId, student2Id, testDate2b, 'afternoon', '候补测试2b').lastInsertRowid;
  
  const reservationCountBefore = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(equipmentId, testDate2b, 'afternoon', 'approved') as any).cnt;
  assert(reservationCountBefore === 1, '递补前应有 1 个有效预约');

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservationId);

  const firstResult = promoteWaitlist(Number(equipmentId), testDate2b, 'afternoon');
  assert(firstResult !== null, '第一次递补应成功');
  assert((firstResult as any).id === waitlistId, '应递补指定的排队记录');
  assert((firstResult as any).status === 'promoted', '状态应为 promoted');

  const reservationCountAfter1 = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(equipmentId, testDate2b, 'afternoon', 'approved') as any).cnt;
  assert(reservationCountAfter1 === 1, '第一次递补后应有 1 个有效预约');

  const promotedReservations = db.prepare('SELECT * FROM reservations WHERE waitlist_id = ?').all(waitlistId);
  assert(promotedReservations.length === 1, '应只有 1 条关联此 waitlist_id 的预约');

  const secondResult = promoteWaitlist(Number(equipmentId), testDate2b, 'afternoon');
  assert(secondResult === null, '第二次调用应返回 null（时段已被占用）');

  const reservationCountAfter2 = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(equipmentId, testDate2b, 'afternoon', 'approved') as any).cnt;
  assert(reservationCountAfter2 === 1, '第二次调用后仍只有 1 个有效预约（幂等）');

  const waitlistPromoted = db.prepare("SELECT COUNT(*) as cnt FROM waitlist WHERE status = 'promoted' AND equipment_id = ? AND reserve_date = ? AND time_slot = ?").get(equipmentId, testDate2b, 'afternoon') as any;
  assert(waitlistPromoted.cnt === 1, '应只有 1 条 promoted 状态的排队记录');
});

testSuite('测试 2b: 递补幂等性 - 已递补记录不会被重复递补', () => {
  const testDate2c = '2025-01-16';
  const waitlistId2 = insertWaitlist.run(equipmentId, student3Id, testDate2c, 'evening', '候补测试2c').lastInsertRowid;
  
  db.prepare("UPDATE waitlist SET status = 'promoted', promoted_at = datetime('now') WHERE id = ?").run(waitlistId2);
  db.prepare(`INSERT INTO reservations 
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at, waitlist_id)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'), ?)`).run(
    equipmentId, student3Id, tutorId, testDate2c, 'evening', '测试手动预约', waitlistId2
  );

  const reservationCountBefore = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE waitlist_id = ?').get(waitlistId2) as any).cnt;
  assert(reservationCountBefore === 1, '测试前应有 1 条关联预约');

  const result = promoteWaitlist(Number(equipmentId), testDate2c, 'evening');
  assert(result === null, '已递补的记录不应被再次递补');

  const reservationCountAfter = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE waitlist_id = ?').get(waitlistId2) as any).cnt;
  assert(reservationCountAfter === 1, '递补调用后预约数量不变');
});

testSuite('测试 3: 取消幂等性 - 重复取消预约不应重复递补', () => {
  const testDate3 = '2025-01-21';
  const reservationId = insertReservation.run(equipmentId, student1Id, tutorId, testDate3, 'morning', '测试预约3').lastInsertRowid;
  const waitlistId = insertWaitlist.run(equipmentId, student2Id, testDate3, 'morning', '候补测试3').lastInsertRowid;

  const reservationCountBefore = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(equipmentId, testDate3, 'morning', 'approved') as any).cnt;

  const update1 = db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ? AND status IN ('pending', 'approved')").run(reservationId);
  assert(update1.changes === 1, '第一次取消应影响 1 行');
  if (update1.changes > 0) {
    promoteWaitlist(Number(equipmentId), testDate3, 'morning');
  }

  const reservationCountAfter1 = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(equipmentId, testDate3, 'morning', 'approved') as any).cnt;
  assert(reservationCountAfter1 === 1, '第一次取消递补后应有 1 个有效预约');

  const update2 = db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ? AND status IN ('pending', 'approved')").run(reservationId);
  assert(update2.changes === 0, '第二次取消应影响 0 行（幂等）');
  if (update2.changes > 0) {
    promoteWaitlist(Number(equipmentId), testDate3, 'morning');
  }

  const reservationCountAfter2 = (db.prepare('SELECT COUNT(*) as cnt FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = ?').get(equipmentId, testDate3, 'morning', 'approved') as any).cnt;
  assert(reservationCountAfter2 === 1, '重复取消递补后仍应有 1 个有效预约（不会重复递补）');

  const waitlistPromoted = db.prepare("SELECT COUNT(*) as cnt FROM waitlist WHERE status = 'promoted' AND equipment_id = ? AND reserve_date = ? AND time_slot = ?").get(equipmentId, testDate3, 'morning') as any;
  assert(waitlistPromoted.cnt === 1, '应只有 1 条 promoted 记录');
});

testSuite('测试 4: 排队取消幂等性', () => {
  const testDate3 = '2025-01-17';
  const waitlistId = insertWaitlist.run(equipmentId, student1Id, testDate3, 'evening', '测试取消').lastInsertRowid;

  const before = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId) as any;
  assert(before.status === 'waiting', '初始状态应为 waiting');
  assert(before.cancelled_at === null, '初始 cancelled_at 应为 null');

  const update1 = db.prepare("UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(waitlistId);
  assert(update1.changes === 1, '第一次取消应影响 1 行');

  const after1 = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId) as any;
  assert(after1.status === 'cancelled', '取消后状态应为 cancelled');
  assert(after1.cancelled_at !== null, '取消后应设置 cancelled_at');

  const update2 = db.prepare("UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(waitlistId);
  assert(update2.changes === 0, '第二次取消应影响 0 行（幂等）');

  const after2 = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId) as any;
  assert(after2.cancelled_at === after1.cancelled_at, '重复取消不应改变 cancelled_at 时间');
});

testSuite('测试 5: 排队位置计算', () => {
  const testDate4 = '2025-01-18';
  
  insertWaitlist.run(equipmentId, student1Id, testDate4, 'morning', '位置测试1');
  insertWaitlist.run(equipmentId, student2Id, testDate4, 'morning', '位置测试2');
  insertWaitlist.run(equipmentId, student3Id, testDate4, 'morning', '位置测试3');

  const waitlistEntries = db.prepare(`
    SELECT w.*,
      (SELECT COUNT(*) FROM waitlist w2
       WHERE w2.equipment_id = w.equipment_id
       AND w2.reserve_date = w.reserve_date
       AND w2.time_slot = w.time_slot
       AND w2.status = 'waiting'
       AND w2.id < w.id) + 1 as position
    FROM waitlist w
    WHERE w.equipment_id = ? AND w.reserve_date = ? AND w.time_slot = ? AND w.status = 'waiting'
    ORDER BY w.id ASC
  `).all(equipmentId, testDate4, 'morning') as any[];

  assert(waitlistEntries.length === 3, '应有 3 条排队记录');
  assert(waitlistEntries[0].position === 1, '第一条记录位置应为 1');
  assert(waitlistEntries[1].position === 2, '第二条记录位置应为 2');
  assert(waitlistEntries[2].position === 3, '第三条记录位置应为 3');
});

testSuite('测试 6: 无排队时递补返回 null', () => {
  const testDate5 = '2025-01-19';
  insertReservation.run(equipmentId, student1Id, tutorId, testDate5, 'morning', '测试预约');
  
  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ?").run(equipmentId, testDate5, 'morning');
  
  const result = promoteWaitlist(Number(equipmentId), testDate5, 'morning');
  assert(result === null, '无人排队时递补应返回 null');
});

testSuite('测试 7: 时段已被占用时不递补', () => {
  const testDate6 = '2025-01-20';
  insertReservation.run(equipmentId, student1Id, tutorId, testDate6, 'morning', '已存在预约');
  insertWaitlist.run(equipmentId, student2Id, testDate6, 'morning', '候补测试');

  const result = promoteWaitlist(Number(equipmentId), testDate6, 'morning');
  assert(result === null, '时段已被占用时不应递补');

  const waitlistEntry = db.prepare("SELECT status FROM waitlist WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? ORDER BY id DESC LIMIT 1").get(equipmentId, testDate6, 'morning') as any;
  assert(waitlistEntry.status === 'waiting', '排队状态应仍为 waiting');
});

console.log('\n' + '='.repeat(50));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(50));

db.close();

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
const walPath = testDbPath + '-wal';
if (fs.existsSync(walPath)) {
  fs.unlinkSync(walPath);
}
const shmPath = testDbPath + '-shm';
if (fs.existsSync(shmPath)) {
  fs.unlinkSync(shmPath);
}

if (failed > 0) {
  process.exit(1);
}
