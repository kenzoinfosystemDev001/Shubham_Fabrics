import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold text-neutral-900 mb-2">Page Not Found</h2>
      <p className="text-xs text-neutral-500 mb-4">Could not find the requested resource.</p>
      <Link
        href="/login"
        className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
      >
        Return to Login
      </Link>
    </div>
  );
}
