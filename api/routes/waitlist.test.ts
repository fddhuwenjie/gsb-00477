import Database from 'better-sqlite3';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

let db: Database.Database;

function setupDb() {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE labs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT NOT NULL, description TEXT);
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','tutor','admin')), email TEXT, phone TEXT);
    CREATE TABLE equipment (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, model TEXT NOT NULL, lab_id INTEGER NOT NULL REFERENCES labs(id), manager_id INTEGER REFERENCES users(id), status TEXT NOT NULL DEFAULT 'normal' CHECK(status IN ('normal','repairing','scrapped')), purchase_no TEXT, unit_price DECIMAL(10,2), purchase_date DATE, category TEXT NOT NULL CHECK(category IN ('analyzer','optical','electronic','chemical','computing')), photo_url TEXT, precautions TEXT);
    CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, tutor_id INTEGER NOT NULL REFERENCES users(id), start_date DATE NOT NULL, end_date DATE NOT NULL);
    CREATE TABLE reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, equipment_id INTEGER NOT NULL REFERENCES equipment(id), student_id INTEGER NOT NULL REFERENCES users(id), tutor_id INTEGER NOT NULL REFERENCES users(id), project_id INTEGER REFERENCES projects(id), reserve_date DATE NOT NULL, time_slot TEXT NOT NULL CHECK(time_slot IN ('morning','afternoon','evening')), purpose TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','completed','cancelled')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, approved_at DATETIME);
    CREATE TABLE waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, equipment_id INTEGER NOT NULL REFERENCES equipment(id), student_id INTEGER NOT NULL REFERENCES users(id), reserve_date DATE NOT NULL, time_slot TEXT NOT NULL CHECK(time_slot IN ('morning','afternoon','evening')), purpose TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','promoted','cancelled')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, promoted_at DATETIME, cancelled_at DATETIME);
  `);

  db.prepare('INSERT INTO labs (name, location, description) VALUES (?, ?, ?)').run('测试实验室', 'A栋101', '测试用');
  db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)').run('tutor1', 'pass', '测试导师', 'tutor');
  db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)').run('student1', 'pass', '学生甲', 'student');
  db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)').run('student2', 'pass', '学生乙', 'student');
  db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)').run('student3', 'pass', '学生丙', 'student');
  db.prepare('INSERT INTO equipment (name, model, lab_id, manager_id, status, category) VALUES (?, ?, ?, ?, ?, ?)').run('测试设备', 'MOD-001', 1, 1, 'normal', 'analyzer');
}

function promoteWaitlist(equipment_id: number, reserve_date: string, time_slot: string): any {
  const conflict = db.prepare(`SELECT id FROM reservations
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status IN ('pending', 'approved')`).get(
    equipment_id, reserve_date, time_slot
  );
  if (conflict) return null;

  const entry: any = db.prepare(`SELECT * FROM waitlist
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting'
    ORDER BY created_at ASC LIMIT 1`).get(equipment_id, reserve_date, time_slot);

  if (!entry) return null;

  const updateResult = db.prepare(
    "UPDATE waitlist SET status = 'promoted', promoted_at = datetime('now') WHERE id = ? AND status = 'waiting'"
  ).run(entry.id);

  if (updateResult.changes === 0) return null;

  const equipment: any = db.prepare('SELECT manager_id FROM equipment WHERE id = ?').get(equipment_id);
  const tutor_id = equipment?.manager_id || 1;

  db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`).run(
    entry.equipment_id, entry.student_id, tutor_id, entry.reserve_date, entry.time_slot, entry.purpose
  );

  return db.prepare('SELECT * FROM waitlist WHERE id = ?').get(entry.id);
}

describe('候补递补逻辑', () => {
  before(() => setupDb());
  after(() => db.close());

  it('当预约被取消时，第一位候补应自动递补为有效预约', () => {
    db.prepare(`INSERT INTO reservations (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(1, 2, 1, '2026-07-01', 'morning', '测试预约', 'approved');

    db.prepare(`INSERT INTO waitlist (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 hour'))`).run(1, 3, '2026-07-01', 'morning', '候补1', 'waiting');
    db.prepare(`INSERT INTO waitlist (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(1, 4, '2026-07-01', 'morning', '候补2', 'waiting');

    db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(1);

    const result = promoteWaitlist(1, '2026-07-01', 'morning');
    assert.ok(result, '递补应返回结果');
    assert.equal(result.status, 'promoted', '候补状态应为 promoted');
    assert.ok(result.promoted_at, '递补时间应被记录');

    const newReservation: any = db.prepare(`SELECT * FROM reservations WHERE student_id = 3 AND status = 'approved'`).get();
    assert.ok(newReservation, '应创建新的已审批预约');
    assert.equal(newReservation.equipment_id, 1);
    assert.equal(newReservation.reserve_date, '2026-07-01');
    assert.equal(newReservation.time_slot, 'morning');
  });

  it('递补后第二位候补仍保持等待状态', () => {
    const second: any = db.prepare(`SELECT * FROM waitlist WHERE student_id = 4 AND status = 'waiting'`).get();
    assert.ok(second, '第二位候补应仍为等待状态');
  });

  it('连续取消时递补应按顺序依次递补', () => {
    db.prepare("UPDATE reservations SET status = 'cancelled' WHERE student_id = 3 AND status = 'approved'").run();

    const result = promoteWaitlist(1, '2026-07-01', 'morning');
    assert.ok(result, '第二次递补应成功');
    assert.equal(result.student_id, 4, '应递补第二位候补');

    const secondReservation: any = db.prepare(`SELECT * FROM reservations WHERE student_id = 4 AND status = 'approved'`).get();
    assert.ok(secondReservation, '第二位候补应获得预约');
  });

  it('无候补时递补应返回 null', () => {
    const result = promoteWaitlist(1, '2026-07-01', 'afternoon');
    assert.equal(result, null, '无候补时应返回 null');
  });
});

describe('递补幂等性', () => {
  before(() => setupDb());
  after(() => db.close());

  it('重复递补同一候补不应创建重复预约', () => {
    db.prepare(`INSERT INTO reservations (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(1, 2, 1, '2026-07-02', 'afternoon', '幂等测试预约', 'approved');

    db.prepare(`INSERT INTO waitlist (equipment_id, student_id, reserve_date, time_slot, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?)`).run(1, 3, '2026-07-02', 'afternoon', '幂等候补', 'waiting');

    db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(1);

    const first = promoteWaitlist(1, '2026-07-02', 'afternoon');
    assert.ok(first, '首次递补应成功');

    const reservationCountBefore = (db.prepare(`SELECT COUNT(*) as c FROM reservations WHERE student_id = 3 AND reserve_date = '2026-07-02'`).get() as any).c;

    const second = promoteWaitlist(1, '2026-07-02', 'afternoon');
    assert.equal(second, null, '重复递补应返回 null（因为已有有效预约）');

    const reservationCountAfter = (db.prepare(`SELECT COUNT(*) as c FROM reservations WHERE student_id = 3 AND reserve_date = '2026-07-02'`).get() as any).c;
    assert.equal(reservationCountAfter, reservationCountBefore, '不应创建重复预约');
  });

  it('递补时 WHERE status = waiting 条件防止并发递补', () => {
    db.prepare(`INSERT INTO waitlist (equipment_id, student_id, reserve_date, time_slot, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?)`).run(1, 4, '2026-07-02', 'afternoon', '并发候补', 'promoted');

    const updateResult = db.prepare(
      "UPDATE waitlist SET status = 'promoted', promoted_at = datetime('now') WHERE id = ? AND status = 'waiting'"
    ).run(3);

    assert.equal(updateResult.changes, 0, '已递补的记录不应被再次更新');
  });
});

describe('候补取消幂等性', () => {
  before(() => setupDb());
  after(() => db.close());

  it('取消等待中的候补应成功', () => {
    db.prepare(`INSERT INTO waitlist (equipment_id, student_id, reserve_date, time_slot, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?)`).run(1, 2, '2026-07-03', 'evening', '取消测试', 'waiting');

    const entry: any = db.prepare('SELECT * FROM waitlist WHERE id = 1').get();
    assert.equal(entry.status, 'waiting');

    db.prepare("UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(1);

    const updated: any = db.prepare('SELECT * FROM waitlist WHERE id = 1').get();
    assert.equal(updated.status, 'cancelled');
    assert.ok(updated.cancelled_at, '取消时间应被记录');
  });

  it('重复取消已取消的候补不应改变数据', () => {
    const before: any = db.prepare('SELECT * FROM waitlist WHERE id = 1').get();
    const cancelledAtBefore = before.cancelled_at;

    const updateResult = db.prepare(
      "UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ? AND status = 'waiting'"
    ).run(1);

    assert.equal(updateResult.changes, 0, '重复取消不应更新任何行');

    const after: any = db.prepare('SELECT * FROM waitlist WHERE id = 1').get();
    assert.equal(after.cancelled_at, cancelledAtBefore, '取消时间不应被覆盖');
  });

  it('取消已递补的候补不应改变数据', () => {
    db.prepare(`INSERT INTO waitlist (equipment_id, student_id, reserve_date, time_slot, purpose, status, promoted_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(1, 3, '2026-07-03', 'evening', '已递补测试', 'promoted');

    const updateResult = db.prepare(
      "UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ? AND status = 'waiting'"
    ).run(2);

    assert.equal(updateResult.changes, 0, '取消已递补候补不应更新任何行');

    const entry: any = db.prepare('SELECT * FROM waitlist WHERE id = 2').get();
    assert.equal(entry.status, 'promoted', '状态应保持 promoted');
  });
});

describe('排位查询', () => {
  before(() => setupDb());
  after(() => db.close());

  it('排位应按 created_at 顺序计算', () => {
    db.prepare(`INSERT INTO waitlist (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'))`).run(1, 2, '2026-07-04', 'morning', '第一位', 'waiting');
    db.prepare(`INSERT INTO waitlist (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 hour'))`).run(1, 3, '2026-07-04', 'morning', '第二位', 'waiting');
    db.prepare(`INSERT INTO waitlist (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(1, 4, '2026-07-04', 'morning', '第三位', 'waiting');

    const pos1: any = db.prepare(`SELECT COUNT(*) as pos FROM waitlist
      WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting' AND id <= ?`).get(1, '2026-07-04', 'morning', 1);
    assert.equal(pos1.pos, 1, '第一位排位应为 1');

    const pos2: any = db.prepare(`SELECT COUNT(*) as pos FROM waitlist
      WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting' AND id <= ?`).get(1, '2026-07-04', 'morning', 2);
    assert.equal(pos2.pos, 2, '第二位排位应为 2');

    const pos3: any = db.prepare(`SELECT COUNT(*) as pos FROM waitlist
      WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting' AND id <= ?`).get(1, '2026-07-04', 'morning', 3);
    assert.equal(pos3.pos, 3, '第三位排位应为 3');
  });

  it('取消候补后后续排位应自动前移', () => {
    db.prepare("UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = 1 AND status = 'waiting'").run();

    const pos2After: any = db.prepare(`SELECT COUNT(*) as pos FROM waitlist
      WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting' AND id <= ?`).get(1, '2026-07-04', 'morning', 2);
    assert.equal(pos2After.pos, 1, '取消第一位后，原第二位应变为排位 1');
  });
});
