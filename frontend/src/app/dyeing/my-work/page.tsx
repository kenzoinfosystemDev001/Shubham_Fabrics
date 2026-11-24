import { redirect } from 'next/navigation';

/**
 * /dyeing/my-work now has one page per task. Older links (?tab=...) land on the matching page.
 */
export default async function DyeingMyWorkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = typeof params.tab === 'string' ? params.tab : '';
  const programId = typeof params.programId === 'string' ? params.programId : '';

  if (tab === 'create-challan') redirect(`/dyeing/my-work/issue-challan${programId ? `?programId=${encodeURIComponent(programId)}` : ''}`);
  if (tab === 'stock') redirect('/dyeing/my-work/received?view=stock');
  if (tab === 'defective-shelf') redirect('/dyeing/my-work/received?view=defective');
  redirect('/dyeing/my-work/incoming');
}
