import { useState, useEffect } from 'react';
import { pb } from '@/db/pb';
import type { ReviewCycle } from '@/types/types';

/** 生成近 N 个自然月的 YYYY-MM 字符串，最新在前 */
function getMonthKeys(monthsBack: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys; // 已按倒序排列（最新在前）
}

/** 获取某月最后一天的日期字符串 YYYY-MM-DD */
function lastDayOf(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(y, m, 0); // 下月第0天 = 当月最后一天
  const mm = String(last.getMonth() + 1).padStart(2, '0');
  const dd = String(last.getDate()).padStart(2, '0');
  return `${last.getFullYear()}-${mm}-${dd}`;
}

/**
 * 自动确保近 `monthsBack` 个自然月的周期存在，并返回列表。
 * 替代原 Supabase RPC ensure_month_cycles，改用 PocketBase 标准 API。
 *
 * 容错策略：
 * - 读取失败 → 上报错误，返回空列表
 * - 创建失败（如权限不足、记录已存在）→ 静默跳过，不影响读取结果
 * - 多处同时调用时若重复创建报 unique 错误，同样静默跳过后重新拉取
 */
export function useMonthCycles(monthsBack = 3) {
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const monthKeys = getMonthKeys(monthsBack);
        const currentMonthKey = monthKeys[0]; // 最新月份

        // ---------- Step 1: 读取已存在的周期 ----------
        // 用 OR 拼接过滤条件，兼容 PocketBase filter 语法
        const filterExpr = monthKeys.map(k => `year_month="${k}"`).join('||');
        let existingResult;
        try {
          existingResult = await pb.collection('review_cycles').getList<ReviewCycle>(1, 50, {
            filter: filterExpr,
            sort: '-year_month',
          });
        } catch (readErr) {
          // 读取失败（集合不存在 / 网络错误），直接上报
          throw readErr;
        }

        const existing = existingResult.items;
        const existingKeys = new Set(existing.map(c => c.year_month));

        // ---------- Step 2: 补全缺失的月份（容错创建）----------
        const toCreate = monthKeys.filter(k => !existingKeys.has(k));
        const created: ReviewCycle[] = [];

        for (const key of toCreate) {
          const [y, m] = key.split('-');
          const name = `${y}年${parseInt(m)}月`;
          try {
            const record = await pb.collection('review_cycles').create<ReviewCycle>({
              name,
              start_date: `${key}-01`,
              end_date: lastDayOf(key),
              is_active: key === currentMonthKey, // 当月默认开启
              year_month: key,
            });
            created.push(record);
          } catch (createErr) {
            // 常见原因：权限不足 / unique 冲突（并发创建）
            // 静默跳过，最后重新读取一次以获取其他进程创建的记录
            const msg = createErr instanceof Error ? createErr.message : String(createErr);
            console.warn(`[useMonthCycles] 创建周期 ${key} 跳过：${msg}`);
          }
        }

        // ---------- Step 3: 若有创建跳过，重新拉取以确保数据完整 ----------
        let finalCycles: ReviewCycle[];
        if (toCreate.length > 0 && created.length < toCreate.length) {
          // 部分创建失败（可能别的请求已创建），重新查一次
          try {
            const refetch = await pb.collection('review_cycles').getList<ReviewCycle>(1, 50, {
              filter: filterExpr,
              sort: '-year_month',
            });
            finalCycles = refetch.items;
          } catch {
            // refetch 失败就用已有数据
            finalCycles = [...existing, ...created];
          }
        } else {
          finalCycles = [...existing, ...created];
        }

        // 按 year_month 倒序，确保最新月在前
        finalCycles.sort((a, b) =>
          (b.year_month ?? '').localeCompare(a.year_month ?? '')
        );

        if (!cancelled) {
          setCycles(finalCycles);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          console.error('[useMonthCycles] 加载失败:', msg);
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [monthsBack]);

  /** 当前月（列表第一项，即最新月） */
  const currentCycle = cycles[0] ?? null;

  return { cycles, loading, error, currentCycle };
}
