import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='skeleton'
      className={cn('animate-pulse rounded-md', className)}
      style={{
        backgroundColor: 'color-mix(in srgb, currentColor 20%, transparent)',
      }}
      {...props}
    />
  );
}

export { Skeleton };
