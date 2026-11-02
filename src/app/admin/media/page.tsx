import { CheckCircle, HardDrive, Images, MinusCircle, Trash } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { deleteMedia } from "@/lib/actions/admin-catalog";
import { requireAdmin } from "@/lib/server/auth";
import { StatStrip } from "../_components/catalog-ui";
import { ConfirmButton } from "../_components/confirm-button";
import { AdminTitle, Empty, Filters, linkClass, MetricCard, Pagination, StatusDot } from "../_components/ui";
import { dateTime, param, type SearchParams } from "../_lib/format";
import { pageOf } from "../_lib/queries";
import { countMedia, listMedia } from "../_lib/queries-catalog";
import { mediaTotals } from "../_lib/queries-catalog-stats";
import { LibraryUpload } from "./library-upload";

export const metadata: Metadata = { title: "Photos" };

const kilobytes = (bytes: number) => `${Math.round(bytes / 1024).toLocaleString("en-US")} KB`;
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default async function AdminMedia({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const q = param(search, "q");
  const [total, totals] = await Promise.all([countMedia(q), mediaTotals()]);
  const { page, last, offset } = pageOf(search, total);
  const images = await listMedia(q, offset);

  return (
    <>
      <AdminTitle sub="All your product photos. JPG, PNG or WebP, under 3.5 MB each." action={<LibraryUpload />}>Photos</AdminTitle>
      <StatStrip>
        <MetricCard icon={<Images size={18} />} label="All photos" value={totals.total} />
        <MetricCard icon={<CheckCircle size={18} />} label="In use" value={totals.inUse} />
        <MetricCard icon={<MinusCircle size={18} />} label="Not used" value={totals.unused} />
        <MetricCard icon={<HardDrive size={18} />} label="Space used" value={megabytes(totals.bytes)} />
      </StatStrip>
      <Filters path="/admin/media" q={q} placeholder="File name" />
      {images.length ? (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {images.map((image) => {
              const inUse = Boolean(image.usedBy.length || image.orderLines);
              return (
                <li key={image.id} className="adm-card flex flex-col overflow-hidden">
                  <a href={image.path} target="_blank" rel="noreferrer" aria-label={`Open ${image.filename}`} className="relative block aspect-square bg-surface">
                    <Image unoptimized fill sizes="280px" src={image.path} alt={image.filename} className="object-cover" />
                  </a>
                  <div className="grid min-w-0 flex-1 content-start gap-1 p-2">
                    <span><StatusDot tone={inUse ? "success" : "muted"}>{inUse ? "In use" : "Not used"}</StatusDot></span>
                    <p className="truncate text-xs font-medium" title={image.filename}>{image.filename}</p>
                    <p className="text-xs text-muted">{image.width} x {image.height}, {kilobytes(image.byteSize)}</p>
                    <p className="text-xs text-muted">{dateTime(image.createdAt)}</p>
                    {image.usedBy.map((product) => (
                      <Link key={product.id} href={`/admin/products/${product.id}`} className={`${linkClass} truncate text-xs`}>{product.name}</Link>
                    ))}
                    {image.orderLines ? <p className="text-xs text-muted">On {image.orderLines} past {image.orderLines === 1 ? "order" : "orders"}</p> : null}
                  </div>
                  <div className="border-t border-line p-2">
                    <ConfirmButton action={deleteMedia.bind(null, image.id)} prompt="Delete this photo for good? You cannot undo this." confirmLabel="Yes, delete">
                      <Trash size={14} aria-hidden="true" />Delete
                    </ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination path="/admin/media" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty title={q ? "No photos match" : "No photos yet"} body={q ? "Try another file name." : "Upload a photo here or from a product."} />
      )}
    </>
  );
}
