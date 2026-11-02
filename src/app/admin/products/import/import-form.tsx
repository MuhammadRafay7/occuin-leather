"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { applyProductImport, previewProductImport, type ImportPreview, type ImportSummary } from "@/lib/actions/admin-catalog";
import { MAX_IMPORT_CHARS } from "@/lib/catalog-import";
import { useAction } from "../../_components/controls";
import { buttonClass, controlClass, Empty, Notice, primaryButtonClass, Section, Table, Tag } from "../../_components/ui";

const LIST_LIMIT = 200;

function Changes({ title, items }: { title: string; items: ImportSummary["products"] }) {
  if (!items.length) return null;
  return (
    <Section title={`${title}: ${items.length}`}>
      <Table caption={title} head={["Item", "Type", "Changes"]} minWidth="min-w-[560px]">
        {items.slice(0, LIST_LIMIT).map((item) => (
          <tr key={item.key}>
            <td className="break-all">{item.key}</td>
            <td><Tag>{item.created ? "New" : "Update"}</Tag></td>
            <td>{item.changes.join("; ")}</td>
          </tr>
        ))}
      </Table>
      {items.length > LIST_LIMIT ? <p className="mt-1 text-xs text-muted">Showing {LIST_LIMIT} of {items.length}.</p> : null}
    </Section>
  );
}

export function ImportForm() {
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const preview = useAction<ImportPreview>();
  const apply = useAction();
  const nothingToDo = summary && !summary.issues.length && !summary.products.length && !summary.variants.length;

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSummary(null);
    setText("");
    setFileError(null);
    preview.clear();
    apply.clear();
    if (!file) return setFileName("");
    setFileName(file.name);
    if (file.size > MAX_IMPORT_CHARS) return setFileError("The file must be under 3.5 MB.");
    setText(await file.text());
  }

  function showPreview(event: FormEvent) {
    event.preventDefault();
    apply.clear();
    setSummary(null);
    preview.run(() => previewProductImport(text), (outcome) => setSummary(outcome.summary ?? null));
  }

  function confirm() {
    apply.run(() => applyProductImport(text, summary!.fingerprint), (outcome) => {
      preview.clear();
      setSummary(null);
      if (outcome.ok) {
        setText("");
        setFileName("");
      }
    });
  }

  return (
    <div className="grid gap-3">
      <form onSubmit={showPreview} className="adm-card grid gap-3 p-3">
        <label className="adm-field">
          Your product list, as a CSV file
          <input type="file" accept=".csv,text/csv" onChange={choose} className={`${controlClass} h-auto py-1.5`} />
        </label>
        {fileError ? <p role="alert" className="text-xs text-danger">{fileError}</p> : null}
        <div>
          <button type="submit" disabled={!text || preview.pending} className={primaryButtonClass}>{preview.pending ? "Checking" : "Preview changes"}</button>
        </div>
      </form>

      <Notice result={apply.result} />
      <Notice result={preview.result} />

      {summary?.issues.length ? (
        <Section title={`Problems: ${summary.issues.length}`}>
          <Table caption="Import problems" head={["Line", "Problem"]} minWidth="min-w-[480px]">
            {summary.issues.slice(0, LIST_LIMIT).map((issue, index) => (
              <tr key={`${issue.line}-${index}`}>
                <td className="tabular-nums">{issue.line}</td>
                <td className="text-danger">{issue.message}</td>
              </tr>
            ))}
          </Table>
        </Section>
      ) : null}

      {summary && !summary.issues.length ? (
        <>
          <p>{fileName}: {summary.rows} rows checked, {summary.unchanged} products and options already match.</p>
          {nothingToDo ? <Empty title="Nothing to change" body="This file matches the catalogue." /> : null}
          <Changes title="Products" items={summary.products} />
          <Changes title="Options" items={summary.variants} />
          {nothingToDo ? null : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={apply.pending} onClick={confirm} className={primaryButtonClass}>{apply.pending ? "Applying" : "Apply changes"}</button>
              <button type="button" disabled={apply.pending} onClick={() => setSummary(null)} className={buttonClass}>Cancel</button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
