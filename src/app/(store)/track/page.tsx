import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { TrackForm } from "./track-form";

export const metadata: Metadata = { title: "Track an order", robots: { index: false } };

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-[520px] px-page pb-24 pt-header">
      <PageTitle sub="Enter your order reference and the email you used at checkout.">Track an order</PageTitle>
      <TrackForm />
    </div>
  );
}
