import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * What a screen with nothing on it yet says, and where to go next.
 *
 * Used to be one grey sentence. An empty list is the moment somebody decides
 * whether the feature is for them, so it gets an icon, the sentence, and — when
 * there is one — the action that fills it. The action is the caller's: only
 * the screen knows what "start" means for it.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <span className="bg-muted text-foreground flex size-12 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-base font-medium">{title}</p>
      {description && <div className="text-muted-foreground max-w-sm text-sm">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
