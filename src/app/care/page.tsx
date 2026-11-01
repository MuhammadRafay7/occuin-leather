import type { Metadata } from "next";
import { Section, Sections } from "@/components/prose";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Care",
  description: "How to clean, store and look after leather, wool, silk and cotton.",
};

export default function CarePage() {
  return (
    <div className="px-4 pt-24 md:px-8">
      <PageTitle sub="Good materials ask for little. These are the things that make the most difference.">Care</PageTitle>
      <Sections>
        <Section title="Leather">
          <p>Wipe it with a soft dry cloth after wear. Use a barely damp cloth for marks, then let it dry at room temperature, away from radiators and sun.</p>
          <p>Condition it twice a year with a cream made for that leather. Test on a hidden spot first, because conditioners can darken aniline and vegetable-tanned hides.</p>
          <p>Vegetable-tanned leather darkens with light and handling. That is normal, and it is part of why it looks better with age.</p>
          <p>If leather gets soaked, blot it, stuff bags with paper to hold their shape, and leave it to dry slowly. Never use a hair dryer.</p>
        </Section>
        <Section title="Patent leather">
          <p>Clean with a soft cloth. Store it apart from other leather and from printed paper, because the coating can pick up colour from what touches it.</p>
        </Section>
        <Section title="Storing bags">
          <ul>
            <li>Stuff bags with acid-free paper and keep them in a cotton dust bag.</li>
            <li>Never store leather in plastic. It needs to breathe.</li>
          </ul>
        </Section>
      </Sections>
    </div>
  );
}
