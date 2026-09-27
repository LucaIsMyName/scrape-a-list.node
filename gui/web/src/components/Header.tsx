import { FolderOpen, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

type HeaderProps = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenHistory: () => void;
  onOpenOutputs: () => void;
};

export function Header({ theme, onToggleTheme, onOpenHistory, onOpenOutputs }: HeaderProps) {
  return (
    <header className="fixed flex align-center border-b-2 border-gray-200 dark:border-gray-800 justify-between top-0 left-0 right-0 z-50 mb-8 w-full p-2 bg-white dark:bg-black ">
      
      <div className="pr-0 sm:pr-36">
        <h1 className="sr-only text-2xl leading-[1.6] font-bold tracking-tight sm:text-[1.6rem]">SAL</h1>
        <p className="sr-only mt-1.5 text-sm text-muted-foreground">
          Extract any list from any website and export it as CSV
        </p>
      </div>
      <div className=" right-0 top-0 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={onOpenOutputs} aria-label="Browse output CSV files">
          <FolderOpen />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onOpenHistory} aria-label="Open scrape history">
          <History />
        </Button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
