import type { Metadata } from "next";
import { Section, Sections } from "@/components/prose";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Size guide",
  description: "Belt sizes and laptop bag fit.",
};

type Table = { headers: string[]; rows: string[][] };

const BELTS: Table = {
  headers: ["Belt size", "Fits waist", "Buckle to centre hole"],
  rows: [
    ["80", "75 to 79", "80"],
    ["85", "80 to 84", "85"],
    ["90", "85 to 89", "90"],
    ["95", "90 to 94", "95"],
    ["100", "95 to 99", "100"],
  ],
};

function SizeTable({ caption, table }: { caption: string; table: Table }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-fg">
            {table.headers.map((header) => (
              <th key={header} scope="col" className="py-2 pr-4 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map(([label, ...cells]) => (
            <tr key={label} className="border-b border-line">
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

export default function SizeGuidePage() {
  return (
    <div className="px-4 pt-24 md:px-8">
      <PageTitle sub="All measurements are body measurements in centimetres, except where noted. Between two sizes, take the larger.">Size guide</PageTitle>
      <Sections>
        <Section title="How to measure">
          <ul>
            <li>Bust or chest: around the fullest part, under the arms.</li>
            <li>Waist: around the narrowest part of your torso.</li>
            <li>Hip: around the fullest part, feet together.</li>
            <li>Neck: around the base, with one finger of room.</li>
          </ul>
        </Section>
        <Section title="Laptop bags">
          <p>Bureau 15 fits laptops up to 15 inches. Etui 14 fits laptops up to 14 inches. Measure your laptop against the inside sizes on the product page if it is close.</p>
        </Section>
        <Section title="Belts">
          <p>The belt size is the length in centimetres from the buckle to the centre hole.</p>
          <SizeTable caption="Belt sizes in centimetres" table={BELTS} />
        </Section>
      </Sections>
    </div>
  );
}
