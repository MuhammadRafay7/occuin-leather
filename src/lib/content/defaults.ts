import type { ColorKey } from "../studio/spec";
import type { PRESETS } from "../studio/presets";

export type PresetKey = keyof typeof PRESETS;

export type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; caption: string; headers: string[]; rows: string[][] };

export type LinkItem = { label: string; href: string };
export type StandardPage = { title: string; subtitle: string; notice: string; blocks: Block[] };

const heading = (text: string): Block => ({ type: "heading", text });
const paragraph = (text: string): Block => ({ type: "paragraph", text });
const list = (...items: string[]): Block => ({ type: "list", items });

export const DEFAULT_HOME = {
  hero: {
    lineOne: "Make it",
    lineTwo: "yours.",
    ctaLabel: "Design yours",
    secondaryLabel: "Find your bag",
    secondaryHref: "/find-your-bag",
    cueLabel: "See one made",
    forms: [
      { key: "laptop" as PresetKey, label: "Laptop", slug: "bureau-15" },
      { key: "tote" as PresetKey, label: "Tote", slug: "cabas-38" },
      { key: "satchel" as PresetKey, label: "Top handle", slug: "nocturne-28" },
      { key: "crossbody" as PresetKey, label: "Saddle", slug: "selle-22" },
      { key: "weekender" as PresetKey, label: "Weekender", slug: "grand-tour-50" },
    ],
    leathers: ["cognac", "noir", "bordeaux", "navy", "tan"] as ColorKey[],
    fallbackImage: "/images/studio/crossbody.webp",
    fallbackAlt: "A tan leather saddle bag with a shoulder strap",
  },
  categories: {
    visible: true,
    items: [
      { href: "/shop/women", name: "Women", image: "/images/studio/tote.webp", alt: "A leather tote bag for women" },
      { href: "/shop/men", name: "Men", image: "/images/studio/messenger.webp", alt: "A leather messenger bag for men" },
      { href: "/shop/leather/laptop-bags", name: "Laptop bags", image: "/images/studio/laptop.webp", alt: "A rigid leather laptop briefcase" },
      { href: "/shop/leather/wallets", name: "Wallets and cards", image: "/images/studio/billfold.webp", alt: "A brown leather billfold wallet with contrast stitching" },
    ],
  },
  featured: { visible: true, heading: "New in", linkLabel: "View all", linkHref: "/shop/leather", limit: 4 },
  studio: {
    visible: true,
    heading: "Design your own",
    body: "Set the shape, leather, stitching and hardware from a blank pattern. See the price as you go, and we make it to order.",
    ctaLabel: "Open the studio",
    ctaHref: "/studio",
    image: "/images/studio/weekender.webp",
    imageAlt: "A two-tone leather weekender bag",
  },
  story: {
    visible: true,
    preset: "crossbody" as PresetKey,
    slug: "selle-22",
    eyebrow: "From hide to hand",
    heading: "One bag, step by step",
    intro: "Scroll to build it. Every step is a choice you can change in the studio.",
    steps: {
      shape: { title: "The shape", body: "It starts as a form. Set the width, height and depth, and the pattern is cut to your numbers." },
      leather: { title: "The leather", body: "Pick a finish and a colour: box calf, pebbled, saffiano, croc-embossed or suede." },
      panels: { title: "The panels", body: "Add a second leather to the corners, a yoke or one side." },
      closure: { title: "The closure", body: "An open top, a zip or a flap, with the clasp and metal you choose." },
      stitch: { title: "The stitching", body: "Choose the thread colour, the stitch length and one or two rows." },
      carry: { title: "The strap", body: "Handles, a shoulder strap or both, at the length you want." },
    },
    endHeading: "Make it yours",
    endBody: "Try a colour here, then open it in the studio to change anything. Made to order in {{making_time}}.",
    ctaLabel: "Make yours",
    productLabel: "See this bag",
  },
  shapes: {
    visible: true,
    heading: "Pick your shape",
    body: "Every piece opens in the studio, ready to change.",
    linkLabel: "Shop all",
    linkHref: "/shop/leather",
  },
  leathers: {
    visible: true,
    eyebrow: "Up close",
    heading: "Feel the grain",
    body: "Drag across the leather to move the light.",
    ctaLabel: "Start a design in",
  },
  making: {
    visible: true,
    heading: "How your bag is made",
    steps: [
      { title: "You order", body: "Choose a piece or design your own. You see the full price before you order." },
      { title: "We make it", body: "Your piece is cut and made to order in Pakistan. Making and packing takes {{making_time}}." },
      { title: "It ships, tracked", body: "We ship to {{country_count}} countries. Tracked shipping is {{standard_price}}, and it is {{free_shipping_note}}." },
      { title: "It arrives", body: "Counting the making time, tracked shipping arrives in {{standard_arrival}}, express in {{express_arrival}}." },
    ],
  },
  paths: {
    visible: true,
    heading: "Where would you like to start?",
    links: [
      { label: "Shop women", href: "/shop/women", note: "Totes, saddles, buckets and clutches" },
      { label: "Shop men", href: "/shop/men", note: "Messengers, briefs, wallets and weekenders" },
      { label: "Create your own", href: "/studio/create", note: "Start from a blank pattern" },
      { label: "Find your bag", href: "/find-your-bag", note: "Answer a few questions and we suggest a piece" },
    ],
  },
  faq: {
    visible: true,
    heading: "Questions before you order",
    questions: [
      "How long does delivery take?",
      "How do custom orders work?",
      "What leather do you use?",
      "Can I return a piece I designed?",
      "How should I look after leather?",
    ],
    linkLabel: "All questions",
  },
  about: {
    visible: true,
    heading: "Handmade leather bags, made to order",
    body: "OCCUIN makes leather [bags for women](/shop/women) and [men](/shop/men), [laptop bags](/shop/leather/laptop-bags), [wallets](/shop/leather/wallets) and [belts](/shop/leather/belts). Each piece is cut and made to order in Pakistan and shipped worldwide. You can also [design your own leather bag](/studio) in live 3D.",
  },
};

export type HeaderItem = LinkItem & { menu: "none" | "women" | "men" | "custom"; links: LinkItem[] };

const HEADER: HeaderItem[] = [
  { label: "Women", href: "/shop/women", menu: "women", links: [] },
  { label: "Men", href: "/shop/men", menu: "men", links: [] },
  { label: "Laptop bags", href: "/shop/leather/laptop-bags", menu: "none", links: [] },
  { label: "Customise", href: "/studio", menu: "none", links: [] },
  { label: "Create your own", href: "/studio/create", menu: "none", links: [] },
];

export const DEFAULT_NAV = {
  header: HEADER,
  mobileLinks: [
    { label: "Find your bag", href: "/find-your-bag" },
    { label: "Track an order", href: "/track" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  footer: {
    columns: [
      {
        title: "Shop",
        links: [
          { label: "Women", href: "/shop/women" },
          { label: "Men", href: "/shop/men" },
          { label: "Laptop bags", href: "/shop/leather/laptop-bags" },
          { label: "Totes", href: "/shop/leather/totes" },
          { label: "Wallets and cards", href: "/shop/leather/wallets" },
          { label: "Customise", href: "/studio" },
          { label: "Create your own", href: "/studio/create" },
          { label: "Find your bag", href: "/find-your-bag" },
        ],
      },
      {
        title: "Help",
        links: [
          { label: "Contact", href: "/contact" },
          { label: "Track an order", href: "/track" },
          { label: "Shipping and returns", href: "/shipping-returns" },
          { label: "Size guide", href: "/size-guide" },
          { label: "Questions", href: "/faq" },
        ],
      },
      {
        title: "House",
        links: [
          { label: "About", href: "/about" },
          { label: "Leather care", href: "/care" },
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
        ],
      },
    ],
    copyright: "All rights reserved.",
  },
};

const LEGAL_NOTICE = "Template. This text is a starting point and has not had legal review. The owner must have it checked by a lawyer and fill in the business details before launch.";

export const DEFAULT_ABOUT = {
  title: "Fewer things, made properly",
  image: "/images/grey-satchel.jpg",
  imageAlt: "A grey pebbled leather satchel with twin buckles",
  intro: [
    paragraph("OCCUIN makes leather goods by hand in Pakistan and ships them worldwide. We care most about what a piece is made of and how it will look after years of use."),
    paragraph("Every product page lists the full composition, so you know exactly which leather and fittings you are buying."),
    paragraph("We describe the hide and the tanning, and we explain how it will change as you use it."),
  ],
  studioHeading: "You can also start from nothing",
  studioBody: "The studio lets you design a leather piece from a blank pattern. You choose the shape, hide, stitching and hardware, and see the price and lead time as you work. We make it to order.",
  studioCtaLabel: "Open the studio",
  studioCtaHref: "/studio",
  blocks: [
    heading("What is OCCUIN?"),
    paragraph("OCCUIN is a leather goods brand. It makes leather bags, laptop bags, wallets and belts for women and men. Every piece is made to order in Pakistan and shipped worldwide."),
    heading("What does OCCUIN make?"),
    paragraph("The range covers [laptop bags and briefcases](/shop/leather/laptop-bags), [totes](/shop/leather/totes), [top handle bags](/shop/leather/top-handle), [crossbody bags](/shop/leather/crossbody), [travel bags](/shop/leather/travel), [wallets and card cases](/shop/leather/wallets) and [belts](/shop/leather/belts). You can also browse by [women](/shop/women) or [men](/shop/men)."),
    heading("How do custom orders work?"),
    paragraph("There are two ways to order a custom leather bag."),
    list(
      "In the [studio](/studio), you start from one of our forms and change the size, leather, stitching and hardware in live 3D. You can add a monogram of up to four letters. You see the price as you go and order it directly.",
      "In the [designer](/studio/create), you draw your own piece from scratch and see an estimate. You send it to our workshop, we review it and email you a final price, and work starts after you accept it.",
    ),
    heading("How long does an order take?"),
    paragraph("We take {{making_time}} to make and pack a piece. With tracked shipping an order arrives in {{standard_arrival}}, and by express courier it arrives in {{express_arrival}}. A piece designed from scratch usually takes longer, and we confirm the timing with your final price. [Read about shipping and returns](/shipping-returns)."),
  ],
};

export const DEFAULT_FAQ = {
  title: "Questions",
  items: [
    { question: "What is OCCUIN?", answer: "OCCUIN is a leather goods brand. It makes leather bags, laptop bags, wallets and belts for women and men, made to order in Pakistan and shipped worldwide." },
    { question: "Where are OCCUIN pieces made?", answer: "In Pakistan. Every piece is made to order and ships from Pakistan." },
    { question: "How do custom orders work?", answer: "In the [studio](/studio) you change the size, leather, stitching and hardware of a form in live 3D, add a monogram of up to four letters, see the price and order it directly. In the [designer](/studio/create) you draw a piece from scratch and send it to our workshop. We review it, email you a final price, and work starts after you accept it. You pay nothing when you send the design." },
    { question: "How long does delivery take?", answer: "{{making_note}} With tracked shipping an order arrives in {{standard_arrival}}, and by express courier it arrives in {{express_arrival}}. {{standard_label}} costs {{standard_price}}, and it is {{free_shipping_note}}. {{express_label}} costs {{express_price}}." },
    { question: "What leather do you use?", answer: "Every product page names the leather and fittings for that piece. In the [studio](/studio) you can choose from {{studio_finishes}}." },
    { question: "Do I need an account to order?", answer: "No. You can check out as a guest. With an account, your orders, saved items and designs stay in one place." },
    { question: "How do I track my order?", answer: "Use the [tracking page](/track) with your order number and the email you ordered with." },
    { question: "How do I return something?", answer: "Every piece is made to order, so we only take back pieces that arrive faulty or differ from your order. [Read the policy](/shipping-returns) or [write to us](/contact) with your order number." },
    { question: "How do I find my size?", answer: "The [size guide](/size-guide) has belt sizes and laptop fit. If you are between sizes, take the larger." },
    { question: "What is the design studio?", answer: "The [studio](/studio) lets you design a leather piece from a blank pattern. You see the price and lead time as you work, and we make it to order." },
    { question: "Can I return a piece I designed?", answer: "Studio pieces are made for you, so they can only be returned if they arrive faulty or differ from your design." },
    { question: "How should I look after leather?", answer: "Keep it dry, away from direct heat, and condition it twice a year. The [care guide](/care) covers each material." },
    { question: "Can I use a promo code on a bespoke piece?", answer: "No. Promo codes apply to ready-made and studio pieces. Bespoke deposits and balances are charged at the price we quote you." },
    { question: "How do I pay?", answer: "{{payment_answer}}" },
    { question: "How much does an OCCUIN piece cost?", answer: "Prices run from {{price_from}} to {{price_to}} in US dollars, before shipping and any import duties. Pieces you design yourself are priced by their size and materials." },
  ],
};

export const DEFAULT_CARE: StandardPage = {
  title: "Care",
  subtitle: "Good materials ask for little. These are the things that make the most difference.",
  notice: "",
  blocks: [
    heading("How do I clean a leather bag?"),
    paragraph("Wipe it with a soft dry cloth after wear. Use a barely damp cloth for marks, then let it dry at room temperature, away from radiators and sun."),
    heading("How often should I condition leather?"),
    paragraph("Condition it twice a year with a cream made for that leather. Test on a hidden spot first, because conditioners can darken aniline and vegetable-tanned hides."),
    heading("Why is my leather getting darker?"),
    paragraph("Vegetable-tanned leather darkens with light and handling. That is normal, and it is part of why it looks better with age."),
    heading("What should I do if my leather bag gets wet?"),
    paragraph("If leather gets soaked, blot it, stuff bags with paper to hold their shape, and leave it to dry slowly. Never use a hair dryer."),
    heading("How do I care for patent leather?"),
    paragraph("Clean with a soft cloth. Store it apart from other leather and from printed paper, because the coating can pick up colour from what touches it."),
    heading("How should I store a leather bag?"),
    list("Stuff bags with acid-free paper and keep them in a cotton dust bag.", "Never store leather in plastic. It needs to breathe."),
  ],
};

export const DEFAULT_SHIPPING: StandardPage = {
  title: "Shipping and returns",
  subtitle: "",
  notice: "",
  blocks: [
    heading("How long does delivery take?"),
    paragraph("Tracked international shipping: arrives in {{standard_arrival}}. Express courier: arrives in {{express_arrival}}. Both times include the {{making_time}} we take to make and pack your piece."),
    heading("Which countries do you ship to?"),
    paragraph("We ship from Pakistan to these countries at checkout: {{countries}}."),
    heading("Can I return an item?"),
    paragraph("Only if it arrives faulty or differs from your order. Every piece is made to order, so we do not accept returns for a change of mind."),
    heading("Shipping"),
    list("{{standard_label}}: {{standard_price}}.", "{{express_label}}: {{express_price}}."),
    paragraph("{{making_note}} Orders arrive in {{standard_arrival}} with tracked shipping, or {{express_arrival}} by express courier."),
    paragraph("Tracked international shipping is {{free_shipping_note}}."),
    paragraph("Prices are in US dollars and do not include import duties or local taxes. Your country sets these, and the courier may collect them on delivery."),
    paragraph("{{payment_lead}}We email you when your order ships. You can follow it any time on the [tracking page](/track) with your order number and email address."),
    heading("Studio pieces"),
    paragraph("Pieces you design in the studio are made to order. The lead time is shown with your price before you buy, and shipping starts once the piece is finished."),
    heading("Returns"),
    paragraph("Every piece is made to order, so we do not take back pieces because of a change of mind. If a piece arrives faulty or differs from your order, [write to us](/contact) with your order number and we will put it right. This does not affect any rights you have by law."),
    heading("Faulty items"),
    paragraph("If something arrives damaged or wrong, [tell us](/contact) and include a photo. We will replace it or refund it."),
  ],
};

export const DEFAULT_SIZE_GUIDE: StandardPage = {
  title: "Size guide",
  subtitle: "All measurements are in centimetres. Between two belt sizes, take the larger.",
  notice: "",
  blocks: [
    heading("Laptop bags"),
    paragraph("Bureau 15 fits laptops up to 15 inches. Etui 14 fits laptops up to 14 inches. Measure your laptop against the inside sizes on the product page if it is close."),
    heading("Belts"),
    paragraph("Measure your waist where you wear a belt, over your clothes. The belt size is the length from the buckle to the centre hole."),
    {
      type: "table",
      caption: "Belt sizes in centimetres",
      headers: ["Belt size", "Fits waist", "Buckle to centre hole"],
      rows: [
        ["80", "75 to 79", "80"],
        ["85", "80 to 84", "85"],
        ["90", "85 to 89", "90"],
        ["95", "90 to 94", "95"],
        ["100", "95 to 99", "100"],
      ],
    },
  ],
};

export const DEFAULT_CONTACT = {
  title: "Contact",
  whatsappLine: "Or message us on [WhatsApp]({{whatsapp_url}}).",
  blocks: [
    paragraph("Or email [{{email}}](mailto:{{email}})."),
    paragraph("If you are writing about an order, include your order number."),
    paragraph("Quick answers: [track an order](/track), [shipping and returns](/shipping-returns), [questions](/faq)."),
  ],
};

export const DEFAULT_TERMS: StandardPage = {
  title: "Terms",
  subtitle: "",
  notice: LEGAL_NOTICE,
  blocks: [
    heading("These terms"),
    paragraph("These terms apply when you use this store or place an order with {{brand}}. By placing an order, you accept them."),
    heading("Orders"),
    paragraph("{{payment_lead}}Your order is confirmed when we email you after payment. We may cancel an order if a piece is no longer available or a price was clearly wrong, and we will refund you in full if we do."),
    heading("Prices and payment"),
    paragraph("Prices are shown in US dollars. Shipping is added at checkout. Any taxes or import duties that apply to your order are your responsibility unless shown otherwise at checkout."),
    heading("Delivery"),
    paragraph("Delivery times are estimates. [Shipping and returns](/shipping-returns) sets out the current options and costs."),
    heading("Returns"),
    paragraph("Every piece is made to order. You can return a piece if it arrives faulty or differs from your order. This does not affect any rights you have by law."),
    heading("Studio pieces"),
    paragraph("Studio pieces are made to your design, so they cannot be returned unless they are faulty or differ from your design. You must not submit monograms or designs that use another person’s trademark or rights."),
    paragraph("Leather is a natural material. Small variations in grain and colour are normal and are not faults."),
    heading("Reviews"),
    paragraph("Reviews must be honest and about a piece you bought. We may remove reviews that are unlawful, abusive or off topic."),
    heading("Our site"),
    paragraph("The content on this site belongs to {{brand}} or its licensors. Do not copy it for commercial use without permission."),
    heading("Liability"),
    paragraph("Nothing in these terms limits liability that cannot be limited by law. Otherwise, our liability for an order is limited to the amount you paid for it."),
    heading("Contact"),
    paragraph("Write to [{{email}}](mailto:{{email}}) with any question about these terms."),
  ],
};

export const DEFAULT_PRIVACY: StandardPage = {
  title: "Privacy",
  subtitle: "",
  notice: LEGAL_NOTICE,
  blocks: [
    heading("Who we are"),
    paragraph("{{brand}} runs this store. For anything about your data, write to [{{email}}](mailto:{{email}})."),
    heading("What we collect"),
    list(
      "Account details: your name, email address and a protected version of your password.",
      "Order details: what you bought, your delivery address and your email address.",
      "Your saved items, bag and studio designs.",
      "Reviews you post and messages you send us.",
      "Your email address if you join the newsletter.",
    ),
    heading("Payments"),
    paragraph("{{payment_privacy}}"),
    heading("How we use it"),
    list(
      "To take, make and deliver your order, and to handle returns.",
      "To send order and account emails.",
      "To answer your messages.",
      "To send the newsletter, if you joined it.",
      "To protect the store from abuse, for example by limiting repeated requests.",
    ),
    heading("Who we share it with"),
    paragraph("We share data only with the services we need to run the store: payment processing, email delivery, delivery carriers and hosting. We do not sell your data."),
    heading("Cookies and local storage"),
    paragraph("We use one cookie to keep you signed in and one to hold the bag and saved items of guests. Your browser also stores your choice of grid columns and that you have seen the cookie notice. We do not use advertising cookies."),
    heading("Keeping and deleting data"),
    paragraph("You can delete your account from your profile page. We keep order records for as long as the law requires, even after an account is deleted. You can ask us for a copy of your data, or ask us to correct or delete it, by writing to the address above."),
    heading("Changes"),
    paragraph("If we change this policy, we will update this page."),
  ],
};

export const DEFAULT_LLMS = `# {{brand}}

> OCCUIN is a leather goods brand. It makes handmade leather bags, laptop bags, wallets and belts for women and men, made to order in Pakistan and shipped worldwide. Customers can buy a listed piece, customise one in a live 3D studio, or draw their own design from scratch for a quote.

Website: https://occuin.com
Contact: {{email}}
Prices are in US dollars. Facts below were last checked on 1 November 2026. The website is the source of truth if anything differs.

## Products and prices

- Listed pieces range from {{price_from}} to {{price_to}}.
- Laptop bags and briefcases: $145 to $315.
- Totes and bucket bags: $235 to $275.
- Top handle bags and satchels: $169 to $270.
- Crossbody bags: $200.
- Travel bags: $470.
- Wallets, card cases and clutches: $39 to $130.
- Belts: $45, in sizes 80 to 100 cm.
- Each product page names the leather and fittings for that piece.
- Studio leather options are box calf, pebbled bull, saffiano, croc-embossed calf and goat suede.

## Custom orders

- Studio: choose a form, change the size, leather, stitching and hardware in live 3D, add a monogram of up to four letters, see the price as you go, and order directly.
- Designer: draw a piece from scratch on a pattern board and see an estimate. Send it to the workshop, which reviews it and emails a final price. Nothing is paid when the design is sent, and work starts after the customer accepts the price.
- A piece designed from scratch usually takes longer than a regular order. The timing is confirmed with the final price.

## Delivery

- Every piece is made to order. Making and packing takes {{making_time}}, then it ships from Pakistan.
- Tracked international shipping costs {{standard_price}}, is {{free_shipping_note}}, and arrives in {{standard_arrival}} in total.
- Express courier costs {{express_price}} and arrives in {{express_arrival}} in total.
- Prices do not include import duties or local taxes. The customer's country sets these, and the courier may collect them on delivery.
- Checkout currently lists {{country_count}} destinations, shown on the shipping page.

## Policies

- Returns are accepted only if a piece arrives faulty or differs from the order. Because every piece is made to order, change of mind returns are not accepted. A faulty or wrong piece is replaced or refunded. This does not affect rights customers have by law.
- Pieces designed by the customer can only be returned if they arrive faulty or differ from the design.
- {{payment_summary}}
- Guest checkout is available. No account is needed.

## Key pages

- [Women](https://occuin.com/shop/women): leather bags, wallets and belts for women
- [Men](https://occuin.com/shop/men): leather briefcases, bags, wallets and belts for men
- [All leather goods](https://occuin.com/shop/leather): the full collection
- [Laptop bags](https://occuin.com/shop/leather/laptop-bags): laptop bags, briefcases and sleeves
- [Wallets](https://occuin.com/shop/leather/wallets): wallets, card cases and clutches
- [Studio](https://occuin.com/studio): customise a leather piece in 3D
- [Designer](https://occuin.com/studio/create): draw your own leather piece from scratch
- [About](https://occuin.com/about): what OCCUIN is and how custom orders work
- [Questions](https://occuin.com/faq): answers about orders, delivery, returns and payment
- [Shipping and returns](https://occuin.com/shipping-returns): delivery times, costs and destinations
- [Leather care](https://occuin.com/care): how to clean, condition and store leather
- [Size guide](https://occuin.com/size-guide): belt sizes and laptop fit
- [Contact](https://occuin.com/contact): write to OCCUIN

## Optional

- [Privacy](https://occuin.com/privacy): how personal data is handled
- [Terms](https://occuin.com/terms): terms of sale
- [Sitemap](https://occuin.com/sitemap.xml): every public URL
`;

export const DEFAULT_SEO = {
  siteTitle: "OCCUIN | Handmade Leather Bags and Custom Leather Goods",
  siteDescription: "Handmade leather bags, laptop bags, wallets and belts for women and men. Design your own in live 3D. Made in Pakistan and shipped worldwide.",
  organizationDescription: "Handmade leather bags, laptop bags, wallets and belts for women and men, made to order in Pakistan and shipped worldwide.",
  ogImage: "/images/og.jpg",
  ogImageAlt: "OCCUIN handmade leather tote",
  pages: {} as Record<string, { title: string; description: string }>,
  llms: DEFAULT_LLMS,
};

export const DEFAULT_BESPOKE = { depositPercent: 50, quoteDays: 30 };
export const DEFAULT_REDIRECTS = { rules: [] as { source: string; destination: string; permanent: boolean; enabled: boolean }[] };
