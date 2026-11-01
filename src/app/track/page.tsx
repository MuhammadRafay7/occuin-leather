import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { TrackForm } from "./track-form";

export const metadata: Metadata = { title: "Track an order" };

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-[520px] px-4 pb-24 pt-24 md:px-8">
      <PageTitle sub="Enter your order reference and the email you used at checkout.">Track an order</PageTitle>
      <TrackForm />
    </div>
  );
}
