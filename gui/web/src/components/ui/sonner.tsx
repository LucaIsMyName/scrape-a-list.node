import { Toaster as Sonner } from 'sonner';

function Toaster({ theme }: { theme?: 'light' | 'dark' | 'system' }) {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
        },
      }}
    />
  );
}

export { Toaster };
