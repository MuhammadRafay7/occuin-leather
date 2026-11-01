export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  if (error) return <p role="alert" className="border border-danger p-3 text-sm text-danger">{error}</p>;
  if (notice) return <p role="status" className="border border-line p-3 text-sm">{notice}</p>;
  return null;
}
