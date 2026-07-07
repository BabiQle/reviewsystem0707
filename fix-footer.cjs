const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/layouts/AppLayout.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the footer section by looking for the unique marker
const marker = 'border-t border-sidebar-border px-3 py-3';
const idx = content.indexOf(marker);
if (idx === -1) {
  console.log('MARKER NOT FOUND');
  process.exit(1);
}

// Find the start of the div (go back to find the indent)
const divStart = content.lastIndexOf('\n      <div className="border-t', idx);
const divEndIdx = content.indexOf('</div>\n    </div>', idx);

const before = content.substring(0, divStart);
const after = content.substring(divEndIdx + 1);

const newFooter = `      <div className="border-t border-sidebar-border px-3 py-3">
        {!displayName ? (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground px-2"
            onClick={() => navigate('/login')}
          >
            <Lock className="w-4 h-4 text-sidebar-foreground" />
            <span className="text-base font-medium truncate">鐧诲綍 / 娉ㄥ唽</span>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground px-2"
              >
                <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-base font-medium truncate text-sidebar-foreground">{displayName}</p>
                </div>
                <ChevronDown className="w-3 h-3 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{displayName}</p>
                <Badge variant="secondary" className="text-xs mt-1">{ROLE_LABELS[role]}</Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenPwdDialog}>
                <Lock className="w-4 h-4 mr-2" />
                修改密码
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>`;

content = before + newFooter + after;
fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
