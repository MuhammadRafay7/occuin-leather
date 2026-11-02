import Link from "next/link";
import { buttonClass, Empty } from "./_components/ui";

export default function AdminNotFound() {
  return <Empty title="We could not find that page" body="It may have moved, or the record may have been deleted." action={<Link href="/admin" className={buttonClass}>Back to dashboard</Link>} />;
}
