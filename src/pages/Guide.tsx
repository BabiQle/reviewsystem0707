import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCog, UserCheck, User, ClipboardList, LockKeyhole, AlertCircle, CheckCircle, ShieldCheck, RefreshCw, HelpCircle, Info, LucideIcon } from 'lucide-react';
import { APP_VERSION_FULL } from '@/App';

interface RoleConfig {
  icon: LucideIcon;
  name: string;
  badge?: string;
  desc: string;
  highlight?: string;
  containerClass: string;
  iconClass: string;
  badgeClass: string;
}

interface StepConfig {
  icon: LucideIcon;
  step?: string;
  desc: string;
  text?: string;
  containerClass?: string;
  iconClass?: string;
  hasExtra?: boolean;
}

interface SectionProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

interface SectionTitleProps {
  icon: LucideIcon;
  title: string;
}

const ROLES_DATA: RoleConfig[] = [
  { icon: UserCog, name: '管理员', badge: '最高权限', desc: '管理账号、开启评价周期、查看全员评分统计数据；', highlight: '审批成员的解锁修改申请。', containerClass: 'bg-indigo-50 border-indigo-200/50', iconClass: 'text-indigo-500', badgeClass: 'bg-indigo-100 text-indigo-700' },
  { icon: UserCheck, name: '评审人', desc: '完成月度互评、查看自己提交的评价记录与个人数据；标注完成后可申请修改，待管理员审批通过后可继续修改已提交的评价。', containerClass: 'bg-slate-50 border-slate-200/50', iconClass: 'text-slate-500', badgeClass: '' },
  { icon: User, name: '组员', desc: '仅查看收到的评价与个人统计，无法发起打分，也不能提交修改申请。', containerClass: 'bg-slate-50 border-slate-200/50', iconClass: 'text-slate-400', badgeClass: '' },
];

const STEPS_DATA: StepConfig[] = [
  { step: '填写评价', desc: '在侧边栏打开【填写评价】，为每位成员逐项打分并提交。', icon: UserCheck },
  { step: '完成标注', desc: '点击顶部【完成本月标注】按钮锁定本期评价。一旦完成，评价进入只读状态，当月不可直接修改。', icon: CheckCircle },
  { step: '申请解锁', desc: '如需修改，点击【申请修改】按钮，系统将向管理员发送审核请求。', icon: LockKeyhole },
  { step: '等待审批', desc: '审批结果将通过右下角即时通知告知。', icon: AlertCircle, hasExtra: true },
  { step: '再次锁定', desc: '审批通过后可继续修改，修改完成后再次点击【完成本月标注】锁定。', icon: RefreshCw },
];

const ADMIN_STEPS_DATA: StepConfig[] = [
  { icon: LockKeyhole, text: '在【用户管理】点击【审批解锁】查看待审批申请', containerClass: 'bg-slate-50 border-slate-200/50', iconClass: 'text-amber-500' },
  { icon: CheckCircle, text: '批准后系统自动通知申请人，允许重新修改', containerClass: 'bg-emerald-50 border-emerald-200/50', iconClass: 'text-emerald-500' },
  { icon: AlertCircle, text: '驳回后评价保持锁定状态', containerClass: 'bg-rose-50 border-rose-200/50', iconClass: 'text-rose-500' },
];

const FAQ_DATA = [
  '看不到【填写评价】：账号无评审权限，仅可查看个人数据',
  '菜单出现红色提醒：本月互评尚未提交，需及时完成',
  '提交后无法修改：为保证公平，已提交评价自动锁定。如需修改请申请解锁',
  '申请修改无回应：请联系管理员审批，或留意右下角通知',
  '登录异常：核对账号密码，忘记密码可联系管理员重置',
];

const SectionTitle = memo<SectionTitleProps>(({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
    <Icon className="w-5 h-5 text-indigo-600" />
    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
  </div>
));
SectionTitle.displayName = 'SectionTitle';

const Section = memo<SectionProps>(({ title, icon: Icon, children, className = '' }) => (
  <Card className={`border-slate-200 shadow-sm ${className}`}>
    <CardContent className="p-6">
      <SectionTitle icon={Icon} title={title} />
      {children}
    </CardContent>
  </Card>
));
Section.displayName = 'Section';

export default function GuidePage() {
  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden select-none">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
              <Info className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">使用指南</h1>
              <p className="text-xs text-slate-500">请仔细阅读以下操作流程与规则说明</p>
            </div>
          </div>
          <Badge variant="outline" className="text-slate-600 border-slate-200 font-normal">{APP_VERSION_FULL}</Badge>
        </div>
      </div>

      {/* 内容区域 */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Section title="一、账号角色与权限" icon={UserCog}>
            <div className="space-y-4">
              {ROLES_DATA.map((role) => (
                <div key={role.name} className={`p-4 rounded-lg border ${role.containerClass}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <role.icon className={`w-4 h-4 ${role.iconClass}`} />
                    <span className="font-medium text-slate-900">{role.name}</span>
                    {role.badge && <Badge className={`border-0 text-xs ${role.badgeClass}`}>{role.badge}</Badge>}
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {role.desc}
                    {role.highlight && <span className="text-indigo-600 font-medium">{role.highlight}</span>}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="二、评审人操作流程" icon={ClipboardList}>
            <div className="space-y-4">
              {STEPS_DATA.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0 mt-0.5">{idx + 1}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className="w-4 h-4 text-slate-500" />
                      <span className="font-medium text-slate-900">{item.step}</span>
                    </div>
                    <p className="text-slate-600 text-sm">{item.desc}</p>
                    {item.hasExtra && (
                      <div className="flex gap-3 mt-2">
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs"><CheckCircle className="w-3 h-3 mr-1" /> 通过</Badge>
                        <Badge className="bg-rose-100 text-rose-700 border-0 text-xs"><AlertCircle className="w-3 h-3 mr-1" /> 驳回</Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="三、管理员审批操作" icon={ShieldCheck}>
            <div className="space-y-3">
              {ADMIN_STEPS_DATA.map((step, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${step.containerClass}`}>
                  <step.icon className={`w-4 h-4 ${step.iconClass}`} />
                  <span className="text-sm text-slate-700">{step.text}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="四、常见问题" icon={HelpCircle}>
            <div className="space-y-3">
              {FAQ_DATA.map((q, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-slate-600">
                  <span className="text-xs font-bold text-indigo-500 mt-0.5">❓</span>
                  <p className="leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </Section>

          <p className="text-center text-xs text-slate-400 py-4">团队互评平台 © 2026 版权所有</p>
        </div>
      </main>
    </div>
  );
}
