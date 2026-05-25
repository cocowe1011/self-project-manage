const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const MAX_BATCH = 100;

// 分批拉取集合全部记录（云函数单次 get 默认最多 100 条）
const fetchAllFromCollection = async (collectionName, options = {}) => {
  const { where } = options;
  let countQuery = db.collection(collectionName);
  if (where) countQuery = countQuery.where(where);
  const countRes = await countQuery.count();
  const total = countRes.total;
  if (total === 0) return [];

  const batchTimes = Math.ceil(total / MAX_BATCH);
  const tasks = [];
  for (let i = 0; i < batchTimes; i++) {
    let query = db.collection(collectionName);
    if (where) query = query.where(where);
    tasks.push(query.skip(i * MAX_BATCH).limit(MAX_BATCH).get());
  }
  const results = await Promise.all(tasks);
  return results.reduce((acc, cur) => acc.concat(cur.data), []);
};

// 项目状态枚举
const PROJECT_STATUS = {
  NOT_STARTED: "未开始",
  IN_DEVELOPMENT: "开发中",
  DEVELOPMENT_COMPLETE: "开发完成",
  ON_SITE_DEBUGGING: "现场调试中",
  DELIVERED: "已交付运维中",
  CANCELLED: "已作废",
};

// 日志类型枚举
const LOG_TYPE = {
  PROJECT_CREATED: "项目建立",
  INCOME_RECEIVED: "收到入款",
  STATUS_CHANGED: "项目进度变更",
};

// 解析日期字符串（支持 YYYY-MM-DD HH:mm:ss 格式，使用本地时区）
const parseDateTime = (dateStr) => {
  // 尝试解析 YYYY-MM-DD HH:mm:ss 格式
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (match) {
    const [, year, month, day, hours = 0, minutes = 0, seconds = 0] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );
  }
  // 兜底：直接使用 new Date 解析
  return new Date(dateStr);
};

// 创建项目
const createProject = async (event) => {
  const { name, client, expectedIncome, description, startDate, firstPaymentDate, devStartDate, devEndDate, finalPaymentDate } = event.data;
  const now = db.serverDate();

  try {
    // 创建项目
    const projectRes = await db.collection("projects").add({
      data: {
        name,
        client,
        expectedIncome: Number(expectedIncome),
        status: PROJECT_STATUS.NOT_STARTED,
        description: description || "",
        startDate: startDate || "",
        firstPaymentDate: firstPaymentDate || "",
        devStartDate: devStartDate || "",
        devEndDate: devEndDate || "",
        finalPaymentDate: finalPaymentDate || "",
        createdAt: now,
        updatedAt: now,
      },
    });

    // 自动生成"项目建立"日志
    await db.collection("project_logs").add({
      data: {
        projectId: projectRes._id,
        type: LOG_TYPE.PROJECT_CREATED,
        content: `项目「${name}」已创建，预计收入 ¥${Number(expectedIncome).toLocaleString()}`,
        createdAt: now,
      },
    });

    return {
      success: true,
      data: { _id: projectRes._id },
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 获取项目列表（含已到账/未到账金额汇总）
const getProjectList = async () => {
  try {
    // 获取所有项目
    const projectsRes = await db.collection("projects").orderBy("startDate", "desc").get();

    // 获取所有收入记录并按项目分组汇总
    const incomeRes = await db.collection("income_records").get();
    const incomeByProject = {};

    incomeRes.data.forEach((record) => {
      if (!incomeByProject[record.projectId]) {
        incomeByProject[record.projectId] = 0;
      }
      incomeByProject[record.projectId] += record.amount;
    });

    // 组装返回数据
    const projects = projectsRes.data.map((project) => {
      const receivedAmount = incomeByProject[project._id] || 0;
      const unreceivedAmount = project.expectedIncome - receivedAmount;
      return {
        ...project,
        receivedAmount,
        unreceivedAmount,
      };
    });

    return {
      success: true,
      data: projects,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 获取项目详情
const getProjectDetail = async (event) => {
  const { projectId } = event;

  try {
    // 获取项目信息
    const projectRes = await db.collection("projects").doc(projectId).get();

    if (!projectRes.data) {
      return {
        success: false,
        errMsg: "项目不存在",
      };
    }

    // 获取该项目的所有收入记录并汇总
    const incomeRes = await db
      .collection("income_records")
      .where({
        projectId,
      })
      .orderBy("receivedAt", "desc")
      .get();

    const receivedAmount = incomeRes.data.reduce((sum, record) => sum + record.amount, 0);
    const unreceivedAmount = projectRes.data.expectedIncome - receivedAmount;

    return {
      success: true,
      data: {
        ...projectRes.data,
        receivedAmount,
        unreceivedAmount,
        incomeRecords: incomeRes.data,
      },
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增收款记录
const addIncomeRecord = async (event) => {
  const { projectId, amount, receivedAt, paymentMethod, remark } = event.data;
  const now = db.serverDate();

  try {
    // 获取项目信息
    const projectRes = await db.collection("projects").doc(projectId).get();
    const projectName = projectRes.data.name;

    // 创建收入记录
    await db.collection("income_records").add({
      data: {
        projectId,
        amount: Number(amount),
        receivedAt: parseDateTime(receivedAt),
        paymentMethod: paymentMethod || "",
        remark: remark || "",
        createdAt: now,
      },
    });

    // 自动生成"收到入款"日志
    await db.collection("project_logs").add({
      data: {
        projectId,
        type: LOG_TYPE.INCOME_RECEIVED,
        content: `收到入款 ¥${Number(amount).toLocaleString()}${remark ? `，备注：${remark}` : ""}`,
        createdAt: now,
      },
    });

    // 更新项目更新时间
    await db
      .collection("projects")
      .doc(projectId)
      .update({
        data: {
          updatedAt: now,
        },
      });

    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 更新项目状态
const updateProjectStatus = async (event) => {
  const { projectId, status } = event.data;
  const now = db.serverDate();

  try {
    // 获取项目信息
    const projectRes = await db.collection("projects").doc(projectId).get();
    const projectName = projectRes.data.name;
    const oldStatus = projectRes.data.status;

    // 更新项目状态
    await db
      .collection("projects")
      .doc(projectId)
      .update({
        data: {
          status,
          updatedAt: now,
        },
      });

    // 自动生成"项目进度变更"日志
    await db.collection("project_logs").add({
      data: {
        projectId,
        type: LOG_TYPE.STATUS_CHANGED,
        content: `项目状态从「${oldStatus}」变更为「${status}」`,
        createdAt: now,
      },
    });

    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 从项目开始时间解析年份（无开始时间时不计入年度统计与年份范围）
const getYearFromStartDate = (startDate) => {
  if (!startDate) return null;
  const match = String(startDate).match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
};

// 获取首页大盘统计数据
const getDashboardStats = async () => {
  try {
    // 获取所有项目（排除已作废，分批拉取避免默认 100 条上限）
    const projects = await fetchAllFromCollection("projects", {
      where: { status: _.neq(PROJECT_STATUS.CANCELLED) },
    });

    // 计算预计总收入
    const totalExpectedIncome = projects.reduce((sum, p) => sum + p.expectedIncome, 0);

    // 获取所有收入记录并计算已到账总额
    const incomeRecords = await fetchAllFromCollection("income_records");
    const totalReceivedAmount = incomeRecords.reduce((sum, r) => sum + r.amount, 0);

    // 未到账金额
    const totalUnreceivedAmount = totalExpectedIncome - totalReceivedAmount;

    // 收入进度百分比
    const receivedPercent = totalExpectedIncome > 0 
      ? Math.round((totalReceivedAmount / totalExpectedIncome) * 100) 
      : 0;

    // 各状态项目数量统计
    const statusCount = {};
    Object.values(PROJECT_STATUS).forEach((status) => {
      statusCount[status] = projects.filter((p) => p.status === status).length;
    });

    // 获取最近5笔回款记录（按回款日期降序）
    const recentIncomeRes = await db.collection("income_records")
      .orderBy("receivedAt", "desc")
      .limit(5)
      .get();
    const recentIncomes = [];
    const recentRecords = recentIncomeRes.data;
    
    for (const record of recentRecords) {
      const project = projects.find(p => p._id === record.projectId);
      recentIncomes.push({
        _id: record._id,
        projectId: record.projectId,
        projectName: project ? project.name : '未知项目',
        amount: record.amount,
        receivedAt: record.receivedAt,
        remark: record.remark,
      });
    }

    // 按项目汇总收入，用于区分已到账/未到账项目
    const incomeByProject = {};
    incomeRecords.forEach((record) => {
      if (!incomeByProject[record.projectId]) {
        incomeByProject[record.projectId] = 0;
      }
      incomeByProject[record.projectId] += record.amount;
    });

    // 生成项目列表（含到账信息）
    const projectList = projects.map((project) => {
      const receivedAmount = incomeByProject[project._id] || 0;
      const unreceivedAmount = project.expectedIncome - receivedAmount;
      return {
        _id: project._id,
        name: project.name,
        startDate: project.startDate || "",
        expectedIncome: project.expectedIncome,
        receivedAmount,
        unreceivedAmount,
        status: project.status,
      };
    });

    // 已到账项目（有收款记录）
    const receivedProjects = projectList
      .filter(p => p.receivedAmount > 0)
      .sort((a, b) => b.receivedAmount - a.receivedAmount);
    
    // 未到账项目（还有未收回款项）
    const unreceivedProjects = projectList
      .filter(p => p.unreceivedAmount > 0)
      .sort((a, b) => b.unreceivedAmount - a.unreceivedAmount);

    // 年份选择范围：最早项目开始时间年份 ~ 今年
    const currentYear = new Date().getFullYear();
    let minYear = null;
    projects.forEach((p) => {
      const y = getYearFromStartDate(p.startDate);
      if (y != null && (minYear === null || y < minYear)) minYear = y;
    });
    if (minYear === null) minYear = currentYear;

    // 按项目开始时间年份汇总收入
    const yearStatsByYear = {};
    for (let y = minYear; y <= currentYear; y++) {
      yearStatsByYear[y] = {
        totalExpectedIncome: 0,
        totalReceivedAmount: 0,
        totalUnreceivedAmount: 0,
        projectCount: 0,
      };
    }
    projects.forEach((project) => {
      const year = getYearFromStartDate(project.startDate);
      if (!year) return;
      if (!yearStatsByYear[year]) {
        yearStatsByYear[year] = {
          totalExpectedIncome: 0,
          totalReceivedAmount: 0,
          totalUnreceivedAmount: 0,
          projectCount: 0,
        };
      }
      const receivedAmount = incomeByProject[project._id] || 0;
      const expectedIncome = project.expectedIncome || 0;
      const stats = yearStatsByYear[year];
      stats.totalExpectedIncome += expectedIncome;
      stats.totalReceivedAmount += receivedAmount;
      stats.totalUnreceivedAmount += expectedIncome - receivedAmount;
      stats.projectCount += 1;
    });

    return {
      success: true,
      data: {
        totalExpectedIncome,
        totalReceivedAmount,
        totalUnreceivedAmount,
        receivedPercent,
        totalProjects: projects.length,
        statusCount,
        recentIncomes,
        receivedProjects,
        unreceivedProjects,
        projectList,
        minYear,
        currentYear,
        yearStatsByYear,
      },
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 获取项目时间轴日志
const getProjectLogs = async (event) => {
  const { projectId } = event;

  try {
    const logsRes = await db
      .collection("project_logs")
      .where({
        projectId,
      })
      .orderBy("createdAt", "desc")
      .get();

    return {
      success: true,
      data: logsRes.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 更新项目信息
const updateProject = async (event) => {
  const { projectId, name, client, expectedIncome, description, startDate, firstPaymentDate, devStartDate, devEndDate, finalPaymentDate } = event.data;
  const now = db.serverDate();

  try {
    // 获取项目旧信息
    const projectRes = await db.collection("projects").doc(projectId).get();
    const oldName = projectRes.data.name;

    // 更新项目信息
    await db
      .collection("projects")
      .doc(projectId)
      .update({
        data: {
          name,
          client,
          expectedIncome: Number(expectedIncome),
          description: description || "",
          startDate: startDate || "",
          firstPaymentDate: firstPaymentDate || "",
          devStartDate: devStartDate || "",
          devEndDate: devEndDate || "",
          finalPaymentDate: finalPaymentDate || "",
          updatedAt: now,
        },
      });

    // 如果项目名称变更，生成日志
    if (oldName !== name) {
      await db.collection("project_logs").add({
        data: {
          projectId,
          type: "项目信息更新",
          content: `项目名称从「${oldName}」变更为「${name}」`,
          createdAt: now,
        },
      });
    }

    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除收入记录
const deleteIncomeRecord = async (event) => {
  const { recordId } = event.data;
  const now = db.serverDate();

  try {
    // 获取收入记录信息
    const recordRes = await db.collection("income_records").doc(recordId).get();
    const record = recordRes.data;

    // 删除收入记录
    await db.collection("income_records").doc(recordId).remove();

    // 生成日志
    await db.collection("project_logs").add({
      data: {
        projectId: record.projectId,
        type: "收入记录删除",
        content: `删除入款记录 ¥${record.amount.toLocaleString()}`,
        createdAt: now,
      },
    });

    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 作废项目
const cancelProject = async (event) => {
  const { projectId } = event.data;
  const now = db.serverDate();

  try {
    // 获取项目信息
    const projectRes = await db.collection("projects").doc(projectId).get();
    const projectName = projectRes.data.name;

    // 更新项目状态为已作废
    await db
      .collection("projects")
      .doc(projectId)
      .update({
        data: {
          status: PROJECT_STATUS.CANCELLED,
          updatedAt: now,
        },
      });

    // 生成作废日志
    await db.collection("project_logs").add({
      data: {
        projectId,
        type: "项目作废",
        content: `项目「${projectName}」已作废`,
        createdAt: now,
      },
    });

    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 重新启用项目
const reopenProject = async (event) => {
  const { projectId } = event.data;
  const now = db.serverDate();

  try {
    const projectRes = await db.collection("projects").doc(projectId).get();
    const projectName = projectRes.data.name;

    await db
      .collection("projects")
      .doc(projectId)
      .update({
        data: {
          status: PROJECT_STATUS.NOT_STARTED,
          updatedAt: now,
        },
      });

    await db.collection("project_logs").add({
      data: {
        projectId,
        type: "项目重新启用",
        content: `项目「${projectName}」已重新启用，状态恢复为「${PROJECT_STATUS.NOT_STARTED}」`,
        createdAt: now,
      },
    });

    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "createProject":
      return await createProject(event);
    case "getProjectList":
      return await getProjectList(event);
    case "getProjectDetail":
      return await getProjectDetail(event);
    case "addIncomeRecord":
      return await addIncomeRecord(event);
    case "updateProjectStatus":
      return await updateProjectStatus(event);
    case "getDashboardStats":
      return await getDashboardStats(event);
    case "getProjectLogs":
      return await getProjectLogs(event);
    case "updateProject":
      return await updateProject(event);
    case "deleteIncomeRecord":
      return await deleteIncomeRecord(event);
    case "cancelProject":
      return await cancelProject(event);
    case "reopenProject":
      return await reopenProject(event);
    default:
      return {
        success: false,
        errMsg: "未知的操作类型",
      };
  }
};
