import db from './database.js';

export function initDatabase() {
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

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tutor_id INTEGER NOT NULL REFERENCES users(id),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      student_id INTEGER NOT NULL REFERENCES users(id),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS project_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      UNIQUE(project_id, equipment_id)
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      student_id INTEGER NOT NULL REFERENCES users(id),
      tutor_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER REFERENCES projects(id),
      reserve_date DATE NOT NULL,
      time_slot TEXT NOT NULL CHECK(time_slot IN ('morning','afternoon','evening')),
      purpose TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','completed','cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME
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

    CREATE TABLE IF NOT EXISTS fault_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      description TEXT NOT NULL,
      urgency TEXT NOT NULL CHECK(urgency IN ('low','medium','high','critical')),
      status TEXT NOT NULL DEFAULT 'reported' CHECK(status IN ('reported','processing','resolved')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolution TEXT
    );

    CREATE TABLE IF NOT EXISTS trainings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('analyzer','optical','electronic','chemical','computing')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS training_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      training_id INTEGER NOT NULL REFERENCES trainings(id),
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL CHECK(correct_answer IN ('A','B','C','D'))
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

    CREATE TABLE IF NOT EXISTS maintenance_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      frequency TEXT NOT NULL CHECK(frequency IN ('monthly','quarterly','yearly')),
      content TEXT NOT NULL,
      next_due_date DATE NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      plan_id INTEGER REFERENCES maintenance_plans(id),
      maintainer_id INTEGER REFERENCES users(id),
      maintenance_date DATE NOT NULL,
      content TEXT NOT NULL,
      replaced_parts TEXT,
      cost DECIMAL(10,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS equipment_borrows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      borrower_id INTEGER NOT NULL REFERENCES users(id),
      from_lab_id INTEGER NOT NULL REFERENCES labs(id),
      to_lab_id INTEGER NOT NULL REFERENCES labs(id),
      borrow_date DATE NOT NULL,
      return_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','returned')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS consumables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      current_stock INTEGER NOT NULL DEFAULT 0,
      safety_stock INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      supplier TEXT
    );

    CREATE TABLE IF NOT EXISTS consumable_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consumable_id INTEGER NOT NULL REFERENCES consumables(id),
      usage_log_id INTEGER REFERENCES usage_logs(id),
      quantity INTEGER NOT NULL,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER NOT NULL REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS consumable_restock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consumable_id INTEGER NOT NULL REFERENCES consumables(id),
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      restocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      operator_id INTEGER NOT NULL REFERENCES users(id)
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
      promoted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS report_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dimensions TEXT NOT NULL,
      metrics TEXT NOT NULL,
      date_range_start DATE,
      date_range_end DATE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_equipment_lab ON equipment(lab_id);
    CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
    CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
    CREATE INDEX IF NOT EXISTS idx_reservations_equipment ON reservations(equipment_id, reserve_date, time_slot);
    CREATE INDEX IF NOT EXISTS idx_reservations_student ON reservations(student_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_tutor ON reservations(tutor_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_project ON reservations(project_id);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_equipment ON usage_logs(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_fault_reports_equipment ON fault_reports(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_training_qualifications_user ON training_qualifications(user_id, category);
    CREATE INDEX IF NOT EXISTS idx_equipment_borrows_equipment ON equipment_borrows(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equipment_borrows_status ON equipment_borrows(status);
    CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_equipment_project ON project_equipment(project_id);
    CREATE INDEX IF NOT EXISTS idx_consumables_equipment ON consumables(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_waitlist_equipment ON waitlist(equipment_id, reserve_date, time_slot, status);
    CREATE INDEX IF NOT EXISTS idx_waitlist_student ON waitlist(student_id);
  `);

  const labCount = db.prepare('SELECT COUNT(*) as count FROM labs').get() as { count: number };
  if (labCount.count === 0) {
    seedData();
  }
}

function seedData() {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const addDays = (d: Date, days: number) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd;
  };

  const insertLab = db.prepare('INSERT INTO labs (name, location, description) VALUES (?, ?, ?)');
  const labResult = insertLab.run('综合实验中心A', '理工楼3层301室', '高校直属综合性实验室，配备各类科研设备，支持材料、电子、光学等多学科实验');
  const lab2Result = insertLab.run('材料科学实验中心B', '理工楼5层501室', '材料科学专业实验室，配备材料表征和化学分析设备');

  const insertUser = db.prepare('INSERT INTO users (username, password, name, role, email, phone) VALUES (?, ?, ?, ?, ?, ?)');
  const adminId = insertUser.run('admin', 'admin123', '系统管理员', 'admin', 'admin@lab.edu.cn', '13800000001').lastInsertRowid;
  const tutor1Id = insertUser.run('tutor1', 'tutor123', '李教授', 'tutor', 'li@lab.edu.cn', '13800000002').lastInsertRowid;
  const tutor2Id = insertUser.run('tutor2', 'tutor123', '王副教授', 'tutor', 'wang@lab.edu.cn', '13800000003').lastInsertRowid;
  const student1Id = insertUser.run('student1', 'stu123', '张三', 'student', 'zhangsan@stu.edu.cn', '13900000001').lastInsertRowid;
  const student2Id = insertUser.run('student2', 'stu123', '李四', 'student', 'lisi@stu.edu.cn', '13900000002').lastInsertRowid;
  const student3Id = insertUser.run('student3', 'stu123', '王五', 'student', 'wangwu@stu.edu.cn', '13900000003').lastInsertRowid;
  const student4Id = insertUser.run('student4', 'stu123', '赵六', 'student', 'zhaoliu@stu.edu.cn', '13900000004').lastInsertRowid;
  const student5Id = insertUser.run('student5', 'stu123', '钱七', 'student', 'qianqi@stu.edu.cn', '13900000005').lastInsertRowid;

  const insertEquipment = db.prepare(`INSERT INTO equipment 
    (name, model, lab_id, manager_id, status, purchase_no, unit_price, purchase_date, category, photo_url, precautions) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const eq1Id = insertEquipment.run('扫描电子显微镜', 'ZEISS Sigma 300', labResult.lastInsertRowid, tutor1Id, 'normal', 'PUR-2023-001', 850000, '2023-03-15', 'analyzer',
    'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?w=600&h=400&fit=crop',
    '1.开机前需检查冷却水系统和真空系统\n2.样品必须经过导电处理\n3.加速电压不得超过30kV\n4.操作完成后按规程关机，保持真空状态').lastInsertRowid;

  const eq2Id = insertEquipment.run('X射线衍射仪', 'Bruker D8 Advance', labResult.lastInsertRowid, tutor1Id, 'normal', 'PUR-2023-002', 450000, '2023-05-20', 'analyzer',
    'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&h=400&fit=crop',
    '1.开机前需打开冷却水和X射线防护门\n2.样品需平整放置于样品台\n3.测试时禁止开启防护门\n4.测试完成后等待X射线管冷却再关机').lastInsertRowid;

  const eq3Id = insertEquipment.run('荧光显微镜', 'Olympus BX53', labResult.lastInsertRowid, tutor2Id, 'normal', 'PUR-2023-003', 128000, '2023-04-10', 'optical',
    'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600&h=400&fit=crop',
    '1.使用前检查光源和滤光片\n2.物镜转换需轻缓\n3.荧光光源开启后不要频繁开关\n4.使用完毕将亮度调至最低再关闭').lastInsertRowid;

  const eq4Id = insertEquipment.run('紫外可见分光光度计', 'Shimadzu UV-2600', labResult.lastInsertRowid, tutor2Id, 'normal', 'PUR-2023-004', 68000, '2023-06-01', 'optical',
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=600&h=400&fit=crop',
    '1.开机预热30分钟后方可使用\n2.比色皿需配对使用，注意清洁\n3.样品浓度需在检测范围内\n4.测试完毕及时清洗比色皿').lastInsertRowid;

  const eq5Id = insertEquipment.run('数字示波器', 'Tektronix MSO58', labResult.lastInsertRowid, tutor1Id, 'normal', 'PUR-2023-005', 95000, '2023-02-28', 'electronic',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop',
    '1.输入电压不得超过最大量程\n2.探头需与被测电路共地\n3.测量前检查探头补偿\n4.关机前先停止采集').lastInsertRowid;

  const eq6Id = insertEquipment.run('频谱分析仪', 'Keysight N9320B', labResult.lastInsertRowid, tutor1Id, 'repairing', 'PUR-2023-006', 78000, '2023-07-15', 'electronic',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop',
    '1.输入信号功率不得超过最大限值\n2.注意阻抗匹配\n3.使用前进行校准\n4.设备维修中，暂时不可使用').lastInsertRowid;

  const eq7Id = insertEquipment.run('高效液相色谱仪', 'Agilent 1260', labResult.lastInsertRowid, tutor2Id, 'normal', 'PUR-2023-007', 320000, '2023-03-25', 'chemical',
    'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=600&h=400&fit=crop',
    '1.流动相需超声脱气\n2.开机时先开泵再开进样器和检测器\n3.样品需经过滤处理\n4.测试完毕用甲醇冲洗系统30分钟').lastInsertRowid;

  const eq8Id = insertEquipment.run('高性能计算工作站', 'Dell Precision 7960', labResult.lastInsertRowid, adminId, 'normal', 'PUR-2023-008', 156000, '2023-08-10', 'computing',
    'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=600&h=400&fit=crop',
    '1.请勿随意安装未知软件\n2.计算任务请提交到任务队列\n3.重要数据请及时备份\n4.关机请使用系统正常关机，勿强制断电').lastInsertRowid;

  const studentIds = [student1Id, student2Id, student3Id, student4Id, student5Id];
  const tutorIds = [tutor1Id, tutor2Id];
  const equipmentIds = [eq1Id, eq2Id, eq3Id, eq4Id, eq5Id, eq6Id, eq7Id, eq8Id];
  const timeSlots = ['morning', 'afternoon', 'evening'];
  const purposes = [
    '毕业设计实验研究',
    '课程实验数据采集',
    '科研项目样品分析',
    '材料表征测试',
    '光学性能测试',
    '电路调试与测量',
    '化合物成分分析',
    '数值模拟计算'
  ];
  const statuses = ['pending', 'approved', 'approved', 'approved', 'completed'];

  const insertReservation = db.prepare(`INSERT INTO reservations 
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, created_at, approved_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const reservationIds: number[] = [];
  for (let i = 0; i < 10; i++) {
    const reserveDate = formatDate(addDays(today, Math.floor(Math.random() * 5) - 2));
    const status = statuses[i % statuses.length];
    const approvedAt = status !== 'pending' ? new Date().toISOString() : null;
    const rid = insertReservation.run(
      equipmentIds[i % equipmentIds.length],
      studentIds[i % studentIds.length],
      tutorIds[i % tutorIds.length],
      reserveDate,
      timeSlots[i % timeSlots.length],
      purposes[i % purposes.length],
      status,
      new Date().toISOString(),
      approvedAt
    ).lastInsertRowid as number;
    reservationIds.push(rid);
  }

  const insertUsageLog = db.prepare(`INSERT INTO usage_logs 
    (reservation_id, equipment_id, user_id, checkin_time, checkout_time, experiment_content, equipment_status, has_anomaly, sample_count) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  for (let i = 0; i < 3; i++) {
    const checkin = addDays(today, -i);
    checkin.setHours(9, 0, 0);
    const checkout = new Date(checkin);
    checkout.setHours(12, 30, 0);
    insertUsageLog.run(
      reservationIds[i],
      equipmentIds[i],
      studentIds[i],
      checkin.toISOString(),
      checkout.toISOString(),
      [
        '完成纳米材料表面形貌表征，获取高分辨率SEM图像15张，观察到颗粒分布均匀',
        '完成晶体结构XRD衍射分析，测试5个样品，获得完整衍射图谱数据',
        '完成细胞荧光成像实验，获取3组对照组和实验组共60张图像数据'
      ][i],
      '正常',
      0,
      [20, 15, 30][i]
    );
  }

  const insertTraining = db.prepare('INSERT INTO trainings (name, content, category) VALUES (?, ?, ?)');
  const insertQuestion = db.prepare('INSERT INTO training_questions (training_id, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES (?, ?, ?, ?, ?, ?, ?)');

  const t1Id = insertTraining.run('扫描电镜安全操作培训', '本培训涵盖扫描电子显微镜的工作原理、操作流程、安全注意事项、样品制备方法等内容。学员需掌握真空系统操作、电子光学系统调节、图像采集等基本技能。', 'analyzer').lastInsertRowid;
  insertQuestion.run(t1Id, '扫描电镜开机前最先需要检查的是什么？', '样品是否放入', '冷却水和真空系统状态', '电子束电流', '显示器分辨率', 'B');
  insertQuestion.run(t1Id, '扫描电镜样品必须进行什么处理才能观察？', '染色处理', '加热处理', '导电处理', '抛光处理', 'C');
  insertQuestion.run(t1Id, '操作完成后关机时正确的做法是？', '直接关闭电源', '保持真空状态按规程关机', '打开腔室取出样品再关机', '先断开冷却水', 'B');

  const t2Id = insertTraining.run('光学设备使用培训', '本培训涵盖光学显微镜、分光光度计等光学设备的基本原理、操作方法、日常维护等内容。', 'optical').lastInsertRowid;
  insertQuestion.run(t2Id, '使用荧光显微镜时，光源开启后应该？', '频繁开关测试', '避免频繁开关', '一直开到下班', '随时可以关闭', 'B');
  insertQuestion.run(t2Id, '使用比色皿时正确的拿法是？', '手拿光学面', '手拿毛面', '可以随意拿取', '用镊子夹取', 'B');
  insertQuestion.run(t2Id, '物镜转换时应该？', '快速转动', '轻缓操作', '直接扳动物镜', '先取下再换', 'B');

  const t3Id = insertTraining.run('电子测量仪器培训', '本培训涵盖示波器、频谱分析仪等电子测量仪器的使用方法、安全操作规范。', 'electronic').lastInsertRowid;
  insertQuestion.run(t3Id, '示波器测量时探头需要与被测电路？', '共地连接', '隔离连接', '任意连接', '不需要连接', 'A');
  insertQuestion.run(t3Id, '输入信号电压应该？', '尽量大', '不超过最大量程', '越小越好', '无所谓', 'B');
  insertQuestion.run(t3Id, '测量前需要对探头进行？', '补偿校准', '加热处理', '绝缘处理', '屏蔽处理', 'A');

  const t4Id = insertTraining.run('化学分析设备培训', '本培训涵盖液相色谱、气相色谱等化学分析设备的操作规范和安全要求。', 'chemical').lastInsertRowid;
  insertQuestion.run(t4Id, '流动相使用前必须经过？', '加热处理', '超声脱气', '过滤灭菌', '稀释处理', 'B');
  insertQuestion.run(t4Id, '样品注入前需要？', '加热处理', '过滤处理', '稀释到最低', '不需要处理', 'B');
  insertQuestion.run(t4Id, '测试完毕后需要用什么冲洗系统？', '纯水', '甲醇', '缓冲液', '丙酮', 'B');

  const t5Id = insertTraining.run('计算设备使用规范', '本培训涵盖高性能计算工作站的使用规范、数据管理、任务提交等内容。', 'computing').lastInsertRowid;
  insertQuestion.run(t5Id, '使用工作站时正确的做法是？', '随意安装软件', '重要数据及时备份', '可以存储个人文件', '强制关机', 'B');
  insertQuestion.run(t5Id, '计算任务应该？', '直接运行', '提交到任务队列', '越多越好', '随时可以终止', 'B');
  insertQuestion.run(t5Id, '关机应该？', '直接拔电源', '使用系统正常关机', '按电源键强制关闭', '不需要关机', 'B');

  const insertQualification = db.prepare('INSERT INTO training_qualifications (user_id, training_id, category, passed_date, expiry_date, is_valid) VALUES (?, ?, ?, ?, ?, 1)');

  const categories: any = { analyzer: t1Id, optical: t2Id, electronic: t3Id, chemical: t4Id, computing: t5Id };
  const passedDate = formatDate(addDays(today, -30));
  const expiryDate = formatDate(addDays(today, 365 - 30));

  for (let i = 0; i < 5; i++) {
    insertQualification.run(student1Id, categories.analyzer, 'analyzer', passedDate, expiryDate);
    insertQualification.run(student1Id, categories.optical, 'optical', passedDate, expiryDate);
    insertQualification.run(student2Id, categories.analyzer, 'analyzer', passedDate, expiryDate);
    insertQualification.run(student2Id, categories.electronic, 'electronic', passedDate, expiryDate);
    insertQualification.run(student3Id, categories.chemical, 'chemical', passedDate, expiryDate);
    insertQualification.run(student4Id, categories.computing, 'computing', passedDate, expiryDate);
    insertQualification.run(student4Id, categories.optical, 'optical', passedDate, expiryDate);
    insertQualification.run(student5Id, categories.electronic, 'electronic', passedDate, expiryDate);
  }

  const insertMaintenancePlan = db.prepare('INSERT INTO maintenance_plans (equipment_id, frequency, content, next_due_date, is_active) VALUES (?, ?, ?, ?, 1)');
  const frequencies = ['monthly', 'quarterly', 'yearly'];
  const maintContents = [
    '设备外部清洁、电路检查、功能测试',
    '光学系统清洁、光路校准、机械部件润滑',
    '真空系统检漏、电子枪清洁、软件系统更新',
    '色谱柱检查、检测器校准、管路清洗',
    '系统除尘、电源检查、硬盘健康检测'
  ];

  for (let i = 0; i < 8; i++) {
    const freq = frequencies[i % frequencies.length];
    const days = freq === 'monthly' ? 10 : freq === 'quarterly' ? 25 : 60;
    insertMaintenancePlan.run(
      equipmentIds[i],
      freq,
      maintContents[i % maintContents.length],
      formatDate(addDays(today, days))
    );
  }

  const insertMaintenanceRecord = db.prepare('INSERT INTO maintenance_records (equipment_id, plan_id, maintainer_id, maintenance_date, content, replaced_parts, cost) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertMaintenanceRecord.run(eq1Id, 1, tutor1Id, formatDate(addDays(today, -20)), '完成真空系统检查，更换密封圈，电子枪清洗测试', '真空密封圈x1', 1500);
  insertMaintenanceRecord.run(eq7Id, 7, tutor2Id, formatDate(addDays(today, -15)), '完成管路系统清洗，更换在线过滤器，检测器校准', '在线过滤器x2', 800);
  insertMaintenanceRecord.run(eq8Id, 8, adminId, formatDate(addDays(today, -10)), '完成系统除尘，电源模块检查，硬盘健康检测，系统优化', null, 0);

  const lab1Id = labResult.lastInsertRowid;
  const lab2Id = lab2Result.lastInsertRowid;

  const insertBorrow = db.prepare(`INSERT INTO equipment_borrows
    (equipment_id, borrower_id, from_lab_id, to_lab_id, borrow_date, return_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`);
  insertBorrow.run(eq2Id, student3Id, lab1Id, lab2Id, formatDate(today), formatDate(addDays(today, 7)), 'pending');
  insertBorrow.run(eq4Id, student4Id, lab1Id, lab2Id, formatDate(addDays(today, -5)), formatDate(addDays(today, 5)), 'approved');

  const insertProject = db.prepare('INSERT INTO projects (name, tutor_id, start_date, end_date, description) VALUES (?, ?, ?, ?, ?)');
  const proj1Id = insertProject.run('纳米材料表面改性研究', tutor1Id, formatDate(addDays(today, -60)), formatDate(addDays(today, 120)), '研究纳米材料表面改性方法及其对材料性能的影响').lastInsertRowid;
  const proj2Id = insertProject.run('光电功能材料合成与表征', tutor2Id, formatDate(addDays(today, -30)), formatDate(addDays(today, 90)), '开展光电功能材料的新型合成方法研究，并系统表征其光学和电学性能').lastInsertRowid;

  const insertProjectMember = db.prepare('INSERT INTO project_members (project_id, student_id) VALUES (?, ?)');
  insertProjectMember.run(proj1Id, student1Id);
  insertProjectMember.run(proj1Id, student2Id);
  insertProjectMember.run(proj2Id, student3Id);
  insertProjectMember.run(proj2Id, student4Id);

  const insertProjectEquipment = db.prepare('INSERT INTO project_equipment (project_id, equipment_id) VALUES (?, ?)');
  insertProjectEquipment.run(proj1Id, eq1Id);
  insertProjectEquipment.run(proj1Id, eq2Id);
  insertProjectEquipment.run(proj2Id, eq3Id);
  insertProjectEquipment.run(proj2Id, eq4Id);

  const insertConsumable = db.prepare(`INSERT INTO consumables
    (name, equipment_id, current_stock, safety_stock, unit, unit_price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const c1Id = insertConsumable.run('导电胶带', eq1Id, 15, 5, '卷', 25.00, '中科耗材有限公司').lastInsertRowid;
  const c2Id = insertConsumable.run('金溅射靶材', eq1Id, 8, 3, '片', 350.00, '高纯材料科技公司').lastInsertRowid;
  const c3Id = insertConsumable.run('X射线管', eq2Id, 3, 2, '支', 12000.00, 'Bruker原厂').lastInsertRowid;
  const c4Id = insertConsumable.run('荧光抗体', eq3Id, 20, 5, '支', 180.00, '生物试剂供应商').lastInsertRowid;
  const c5Id = insertConsumable.run('比色皿', eq4Id, 30, 10, '对', 45.00, '光学仪器配件厂').lastInsertRowid;
  const c6Id = insertConsumable.run('色谱柱', eq7Id, 4, 2, '根', 2800.00, 'Agilent原厂').lastInsertRowid;
  const c7Id = insertConsumable.run('流动相甲醇', eq7Id, 10, 3, '瓶', 120.00, '化学试剂公司').lastInsertRowid;

  const insertConsumableUsage = db.prepare(`INSERT INTO consumable_usage
    (consumable_id, quantity, user_id) VALUES (?, ?, ?)`);
  insertConsumableUsage.run(c1Id, 2, student1Id);
  insertConsumableUsage.run(c4Id, 3, student3Id);
  insertConsumableUsage.run(c7Id, 1, student5Id);

  const insertWaitlist = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`);
  insertWaitlist.run(eq1Id, student2Id, formatDate(addDays(today, 2)), 'morning', '纳米颗粒形貌观察', 'waiting');
  insertWaitlist.run(eq3Id, student5Id, formatDate(addDays(today, 1)), 'afternoon', '细胞荧光标记观察', 'waiting');
}
