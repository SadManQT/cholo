import { EmptyState } from '../../components/ui';

// Every route from doc 12's page catalog is wired up (this step is "the
// shell every screen will snap into" — doc 13-14 M5), but the screens
// themselves are later roadmap steps (17: auth, 18: booking, 19: driver,
// 22: history/admin, …). This is what an unbuilt route renders until then
// — proof the routing/guards work without faking real page content.
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState title={title} hint="This screen hasn't been built yet." />
    </div>
  );
}
