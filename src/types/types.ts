// 用户角色
export type UserRole = 'admin' | 'reviewer' | 'reviewee_only';

// 用户档案 (与实际数据库及页面使用的字段对齐)
export interface Profile {
  id: string;
  username: string;
  display_name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

// 评价周期 (统一为 MonthCycle，与其他页面实际使用的一致)
export interface MonthCycle {
  id: string;
  name: string;
  start_date: string;
  end_date?: string; // 有些地方可能没用到，设为可选
  is_active: boolean;
}

// 评价维度键名
export type ReviewDimensionKey =
  | 'data_quality'
  | 'personal_efficiency'
  | 'work_compliance'
  | 'work_enthusiasm'
  | 'other_help';

// 评价维度标签映射
export const DIMENSION_LABELS: Record<ReviewDimensionKey, string> = {
  data_quality: '数据质量',
  personal_efficiency: '个人效率',
  work_compliance: '服从工作安排',
  work_enthusiasm: '工作积极性',
  other_help: '其他帮助',
};

// 所有维度列表
export const DIMENSIONS: ReviewDimensionKey[] = [
  'data_quality',
  'personal_efficiency',
  'work_compliance',
  'work_enthusiasm',
  'other_help',
];

// 单个维度的填写数据
export interface DimensionData {
  score: number;
  note: string;
}

// 单人评价表单数据结构（5个维度）
export type ReviewFormData = Record<ReviewDimensionKey, DimensionData>;

// 实际存储在数据库 reviews 表中的记录结构
export interface ReviewRecord {
  id: string;
  cycle_id: string;
  from_user: string;
  to_user: string;
  to_user_name?: string;
  content: string; // 实际存储的是 JSON.parse(ReviewFormData) 后的字符串
  created: string; // PocketBase 默认创建时间字段
}

// 解析后的评价记录（方便在统计页面使用）
export interface ParsedReview extends Omit<ReviewRecord, 'content'> {
  content: ReviewFormData;
}

// 角色标签
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  reviewer: '评审人',
  reviewee_only: '组员',
};

// 角色描述
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: '管理系统、用户和评价周期',
  reviewer: '可填写评价，可查看自己收到的评价，查看统计',
  reviewee_only: '只能查看自己收到的评价',
};
