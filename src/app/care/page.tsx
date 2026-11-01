import type { Metadata } from "next";
import { Section, Sections } from "@/components/prose";
import { PageTitle } from "@/components/ui";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/care");

export default function CarePage() {
  return (
    <div className="px-page pt-header">
      <PageTitle sub="Good materials ask for little. These are the things that make the most difference.">Care</PageTitle>
      <Sections>
        <Section title="How do I clean a leather bag?">
          <p>Wipe it with a soft dry cloth after wear. Use a barely damp cloth for marks, then let it dry at room temperature, away from radiators and sun.</p>
        </Section>
        <Section title="How often should I condition leather?">
          <p>Condition it twice a year with a cream made for that leather. Test on a hidden spot first, because conditioners can darken aniline and vegetable-tanned hides.</p>
        </Section>
        <Section title="Why is my leather getting darker?">
          <p>Vegetable-tanned leather darkens with light and handling. That is normal, and it is part of why it looks better with age.</p>
        </Section>
        <Section title="What should I do if my leather bag gets wet?">
          <p>If leather gets soaked, blot it, stuff bags with paper to hold their shape, and leave it to dry slowly. Never use a hair dryer.</p>
        </Section>
        <Section title="How do I care for patent leather?">
          <p>Clean with a soft cloth. Store it apart from other leather and from printed paper, because the coating can pick up colour from what touches it.</p>
        </Section>
        <Section title="How should I store a leather bag?">
          <ul>
            <li>Stuff bags with acid-free paper and keep them in a cotton dust bag.</li>
            <li>Never store leather in plastic. It needs to breathe.</li>
          </ul>
        </Section>
      </Sections>
    </div>
  );
}
