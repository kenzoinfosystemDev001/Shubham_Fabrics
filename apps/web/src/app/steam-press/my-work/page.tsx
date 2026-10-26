import { redirect } from 'next/navigation';

/** /steam-press/my-work now has one page per task. */
export default function SteamPressMyWorkPage() {
  redirect('/steam-press/my-work/incoming');
}
