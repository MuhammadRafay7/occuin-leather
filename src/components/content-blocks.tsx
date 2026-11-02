import Link from "next/link";
import { Fragment } from "react";
import type { Block } from "@/lib/content/defaults";
import { fillTokens, parseInline, type TokenValues } from "@/lib/content/rich-text";
import { Section, Sections } from "./prose";

export function Inline({ text, tokens }: { text: string; tokens: TokenValues }) {
  return parseInline(fillTokens(text, tokens)).map((part, index) => {
    if (!part.href) return <Fragment key={index}>{part.text}</Fragment>;
    if (part.href.startsWith("/")) return <Link key={index} href={part.href}>{part.text}</Link>;
    const external = part.href.startsWith("https:");
    return <a key={index} href={part.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{part.text}</a>;
  });
}

function ContentTable({ block }: { block: Extract<Block, { type: "table" }> }) {
  return (
    <div>
      <table className="w-full border-collapse text-left text-sm tabular-nums">
        <caption className="sr-only">{block.caption}</caption>
        <thead>
          <tr className="border-b border-fg">
            {block.headers.map((header, index) => (
              <th key={index} scope="col" className="py-2 pr-3 align-bottom font-medium sm:pr-4">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map(([label, ...cells], row) => (
            <tr key={row} className="border-b border-line">
              <th scope="row" className="py-2 pr-4 font-medium">{label}</th>
              {cells.map((cell, index) => (
                <td key={index} className="py-2 pr-4">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BlockView({ block, tokens }: { block: Block; tokens: TokenValues }) {
  if (block.type === "heading") return <h2 className="text-sm font-medium">{block.text}</h2>;
  if (block.type === "paragraph") return <p><Inline text={block.text} tokens={tokens} /></p>;
  if (block.type === "list") return <ul>{block.items.map((item, index) => <li key={index}><Inline text={item} tokens={tokens} /></li>)}</ul>;
  return <ContentTable block={block} />;
}

type Group = { title: string; blocks: Block[] };

function groupBlocks(blocks: Block[]) {
  const groups: Group[] = [];
  for (const block of blocks) {
    if (block.type === "heading") groups.push({ title: block.text, blocks: [] });
    else if (groups.length) groups.at(-1)!.blocks.push(block);
    else groups.push({ title: "", blocks: [block] });
  }
  return groups;
}

export function BlockSections({ blocks, tokens }: { blocks: Block[]; tokens: TokenValues }) {
  return (
    <Sections>
      {groupBlocks(blocks).map((group, index) => (
        <Section key={index} title={group.title}>
          {group.blocks.map((block, position) => <BlockView key={position} block={block} tokens={tokens} />)}
        </Section>
      ))}
    </Sections>
  );
}
