import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils'; // 如果你项目中有 cn 工具，否则用简单的字符串拼接

interface MonthBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const MonthBadge = ({ size = 'sm', className, ...props }: MonthBadgeProps) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        'bg-blue-100 text-blue-700 border-0 ml-2', // ml-2 保持左间距，可去掉并让使用方控制
        sizeClasses[size],
        className
      )}
      {...props}
    >
      本月
    </Badge>
  );
};