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
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student','tutor','admin')),
    email TEXT,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS labs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT
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
    cancelled_at DATETIME,
    status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_waitlist_equipment ON waitlist(equipment_id, reserve_date, time_slot, status);
  CREATE INDEX IF NOT EXISTS idx_waitlist_student ON waitlist(student_id);
`);

const insertUser = db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)');
const tutorId = insertUser.run('tutor1', 'pass', '李导师', 'tutor').lastInsertRowid as number;
const student1Id = insertUser.run('student1', 'pass', '张三', 'student').lastInsertRowid as number;
const student2Id = insertUser.run('student2', 'pass', '李四', 'student').lastInsertRowid as number;
const student3Id = insertUser.run('student3', 'pass', '王五', 'student').lastInsertRowid as number;

const insertLab = db.prepare('INSERT INTO labs (name, location) VALUES (?, ?)');
const labId = insertLab.run('测试实验室', '测试位置').lastInsertRowid as number;

const insertEquipment = db.prepare('INSERT INTO equipment (name, model, lab_id, manager_id, status, category) VALUES (?, ?, ?, ?, ?, ?)');
const equipmentId = insertEquipment.run('测试显微镜', 'Test-100', labId, tutorId, 'normal', 'optical').lastInsertRowid as number;

const testDate = '2025-01-15';
const testSlot = 'morning';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

function promoteWaitlist(equipment_id: number, reserve_date: string, time_slot: string): any {
  const taken = db.prepare(`SELECT id FROM reservations
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status IN ('pending', 'approved')`).get(
    equipment_id, reserve_date, time_slot
  );
  if (taken) return null;

  const promoteTransaction = db.transaction(() => {
    const entry: any = db.prepare(`SELECT * FROM waitlist
      WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting'
      ORDER BY created_at ASC, id ASC LIMIT 1`).get(equipment_id, reserve_date, time_slot);

    if (!entry) return null;

    const updateResult = db.prepare(
      "UPDATE waitlist SET status = 'promoted', promoted_at = datetime('now'), status_updated_at = datetime('now') WHERE id = ? AND status = 'waiting'"
    ).run(entry.id);

    if (updateResult.changes === 0) return null;

    const equipment: any = db.prepare('SELECT manager_id FROM equipment WHERE id = ?').get(equipment_id);
    const tutor_id = equipment?.manager_id || 1;

    db.prepare(`INSERT INTO reservations
      (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'), datetime('now'))`).run(
      entry.equipment_id, entry.student_id, tutor_id, entry.reserve_date, entry.time_slot, entry.purpose
    );

    return db.prepare('SELECT * FROM waitlist WHERE id = ?').get(entry.id);
  });

  try {
    return promoteTransaction();
  } catch {
    return null;
  }
}

console.log('\n🧪 候补自动递补 + 幂等性 测试');
console.log('='.repeat(50));

console.log('\n📋 测试1：基础递补功能 - 取消预约后第一位候补自动转正');

const reservationId = db.prepare(`INSERT INTO reservations
  (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
  VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
  equipmentId, student1Id, tutorId, testDate, testSlot, '初始预约测试'
).lastInsertRowid as number;

const w1Id = db.prepare(`INSERT INTO waitlist
  (equipment_id, student_id, reserve_date, time_slot, purpose, status, status_updated_at)
  VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
  equipmentId, student2Id, testDate, testSlot, '候补测试1'
).lastInsertRowid as number;

const w2Id = db.prepare(`INSERT INTO waitlist
  (equipment_id, student_id, reserve_date, time_slot, purpose, status, status_updated_at)
  VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
  equipmentId, student3Id, testDate, testSlot, '候补测试2'
).lastInsertRowid as number;

const waitingBefore = db.prepare("SELECT COUNT(*) as count FROM waitlist WHERE status = 'waiting' AND equipment_id = ? AND reserve_date = ? AND time_slot = ?").get(equipmentId, testDate, testSlot) as { count: number };
assert(waitingBefore.count === 2, '初始应有2人在排队');

db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservationId);

const promoted = promoteWaitlist(equipmentId, testDate, testSlot);
assert(promoted !== null, 'promoteWaitlist 应返回递补结果');
assert(promoted.student_id === student2Id, '第一位候补（student2）应被递补');
assert(promoted.status === 'promoted', '递补后状态应为 promoted');
assert(promoted.promoted_at !== null, '应设置 promoted_at 时间');

const w1After = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(w1Id) as any;
assert(w1After.status === 'promoted', '第一位候补记录状态变为 promoted');

const w2After = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(w2Id) as any;
assert(w2After.status === 'waiting', '第二位候补仍在等待');

const reservationsAfter = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'approved'").get(equipmentId, testDate, testSlot) as { count: number };
assert(reservationsAfter.count === 1, '递补后应创建1条新的有效预约');

const newReservation = db.prepare("SELECT * FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'approved' ORDER BY id DESC LIMIT 1").get(equipmentId, testDate, testSlot) as any;
assert(newReservation.student_id === student2Id, '新预约的学生应为被递补的学生');

console.log('\n📋 测试2：幂等性 - 重复调用 promoteWaitlist 不产生脏数据');

const promoted2 = promoteWaitlist(equipmentId, testDate, testSlot);
assert(promoted2 === null, '第二次调用 promoteWaitlist 应返回 null（时段已被占用）');

const reservationsCountAfter = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'approved'").get(equipmentId, testDate, testSlot) as { count: number };
assert(reservationsCountAfter.count === 1, '重复调用后有效预约数仍应为1（幂等）');

const promotedWaitlistCount = db.prepare("SELECT COUNT(*) as count FROM waitlist WHERE status = 'promoted' AND equipment_id = ? AND reserve_date = ? AND time_slot = ?").get(equipmentId, testDate, testSlot) as { count: number };
assert(promotedWaitlistCount.count === 1, 'promoted 状态的候补记录数仍应为1（幂等）');

console.log('\n📋 测试3：取消幂等性 - 重复取消预约不重复触发递补');

const cancelAgain = () => {
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(newReservation.id) as any;
  if (reservation.status === 'cancelled' || reservation.status === 'completed' || reservation.status === 'rejected') {
    return false;
  }
  const wasActive = reservation.status === 'pending' || reservation.status === 'approved';
  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(newReservation.id);
  if (wasActive) {
    promoteWaitlist(equipmentId, testDate, testSlot);
  }
  return true;
};

const firstCancel = cancelAgain();
assert(firstCancel === true, '第一次取消应成功并触发递补');

const w2Promoted = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(w2Id) as any;
assert(w2Promoted.status === 'promoted', '第二次取消后第二位候补应被递补');

const secondCancel = cancelAgain();
assert(secondCancel === false, '第二次取消应返回 false（已是取消状态）');

const finalPromotedCount = db.prepare("SELECT COUNT(*) as count FROM waitlist WHERE status = 'promoted' AND equipment_id = ? AND reserve_date = ? AND time_slot = ?").get(equipmentId, testDate, testSlot) as { count: number };
assert(finalPromotedCount.count === 2, '最终应有2条 promoted 记录（幂等取消未造成额外递补）');

const finalReservationCount = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ?").get(equipmentId, testDate, testSlot) as { count: number };
assert(finalReservationCount.count === 3, '最终应有3条预约记录（初始+2次递补）');

console.log('\n📋 测试4：排位计算准确性');

db.exec("DELETE FROM reservations WHERE equipment_id = " + equipmentId);
db.exec("DELETE FROM waitlist WHERE equipment_id = " + equipmentId);

db.prepare(`INSERT INTO reservations
  (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
  VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
  equipmentId, student1Id, tutorId, testDate, testSlot, '测试排位'
);

const pos1Id = db.prepare(`INSERT INTO waitlist
  (equipment_id, student_id, reserve_date, time_slot, purpose, status, status_updated_at)
  VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
  equipmentId, student1Id, testDate, testSlot, '排位测试1'
).lastInsertRowid as number;

const pos2Id = db.prepare(`INSERT INTO waitlist
  (equipment_id, student_id, reserve_date, time_slot, purpose, status, status_updated_at)
  VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
  equipmentId, student2Id, testDate, testSlot, '排位测试2'
).lastInsertRowid as number;

const pos3Id = db.prepare(`INSERT INTO waitlist
  (equipment_id, student_id, reserve_date, time_slot, purpose, status, status_updated_at)
  VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
  equipmentId, student3Id, testDate, testSlot, '排位测试3'
).lastInsertRowid as number;

const getPosition = (waitlistId: number): number => {
  const entry: any = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId);
  const position: any = db.prepare(`SELECT COUNT(*) as pos FROM waitlist
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ?
    AND status = 'waiting' AND id < ?`).get(
    entry.equipment_id, entry.reserve_date, entry.time_slot, entry.id
  );
  return position.pos + 1;
};

assert(getPosition(pos1Id) === 1, '第一位加入的学生排位应为1');
assert(getPosition(pos2Id) === 2, '第二位加入的学生排位应为2');
assert(getPosition(pos3Id) === 3, '第三位加入的学生排位应为3');

db.prepare("UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now'), status_updated_at = datetime('now') WHERE id = ?").run(pos1Id);
assert(getPosition(pos2Id) === 1, '第一位取消后，第二位排位变为1');
assert(getPosition(pos3Id) === 2, '第一位取消后，第三位排位变为2');

console.log('\n📋 测试5：候补取消幂等性');

const w3Before = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(pos3Id) as any;
assert(w3Before.status === 'waiting', '取消前状态应为 waiting');

db.prepare("UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now'), status_updated_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(pos3Id);
const w3After1 = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(pos3Id) as any;
assert(w3After1.status === 'cancelled', '第一次取消后状态为 cancelled');

const result = db.prepare("UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now'), status_updated_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(pos3Id);
assert(result.changes === 0, '第二次取消无数据变更（幂等）');

const finalWaitingCount = db.prepare("SELECT COUNT(*) as count FROM waitlist WHERE status = 'waiting' AND equipment_id = ? AND reserve_date = ? AND time_slot = ?").get(equipmentId, testDate, testSlot) as { count: number };
assert(finalWaitingCount.count === 1, '最终只有1人在排队');

console.log('\n📋 测试6：status_updated_at 字段正确性');

const testWlId = db.prepare(`INSERT INTO waitlist
  (equipment_id, student_id, reserve_date, time_slot, purpose, status, status_updated_at)
  VALUES (?, ?, ?, ?, ?, 'waiting', datetime('now'))`).run(
  equipmentId, student1Id, testDate, 'afternoon', '状态时间测试'
).lastInsertRowid as number;

const created = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(testWlId) as any;
assert(created.status_updated_at !== null, '创建时 status_updated_at 应有值');

db.prepare("UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now'), status_updated_at = datetime('now') WHERE id = ?").run(testWlId);
const cancelled = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(testWlId) as any;
assert(cancelled.cancelled_at !== null, '取消后 cancelled_at 应有值');
assert(cancelled.status_updated_at >= created.status_updated_at, '取消后 status_updated_at 应更新');

console.log('\n' + '='.repeat(50));
console.log(`📊 测试结果：${passed} 通过, ${failed} 失败`);
console.log('='.repeat(50));

db.close();
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

if (failed > 0) {
  process.exit(1);
}
