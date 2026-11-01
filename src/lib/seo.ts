import type { Metadata } from "next";
import { isValidElement, type ReactNode } from "react";
import { BRAND, MAKING_TIME, SHIPPING_METHODS, deliveryEstimate, money, shippingCents, type ShippingMethod } from "@/lib/format";
import { COUNTRIES } from "@/lib/validation";

export const SITE_URL = "https://occuin.com";

const SUFFIX = ` | ${BRAND.name}`;
const DEFAULT_IMAGE = { url: "/images/og.jpg", width: 1200, height: 630, alt: "OCCUIN handmade leather tote" };
const TITLE_RANGE = { min: 50, max: 60 };
const DESCRIPTION_RANGE = { min: 120, max: 155 };

const days = (text: string) => text.match(/\d+/g)!.map(Number) as [number, number];
const arrival = (method: ShippingMethod) => deliveryEstimate(method).replace("Arrives in ", "");

const TRACKED = arrival("standard");
const EXPRESS = arrival("express");

export const absoluteUrl = (path: string) => (path === "/" ? SITE_URL : new URL(path, SITE_URL).href);

type PageMeta = { title: string; description: string };

export const META: Record<string, PageMeta> = {
  "/": {
    title: "Handmade Leather Bags and Custom Leather Goods | OCCUIN",
    description: "Handmade leather bags, laptop bags, wallets and belts for women and men. Made to order in Pakistan, shipped worldwide. Design your own in live 3D.",
  },
  "/shop/women": {
    title: "Women's Leather Bags, Totes and Crossbody Styles | OCCUIN",
    description: "Leather totes, crossbody bags, top handle bags, clutches and laptop bags for women. Each piece is made to order in Pakistan and shipped worldwide.",
  },
  "/shop/men": {
    title: "Men's Leather Bags, Briefcases and Wallets | OCCUIN",
    description: "Leather briefcases, messenger bags, weekenders, wallets and belts for men. Each piece is made to order in Pakistan and shipped worldwide.",
  },
  "/shop/leather": {
    title: "All Handmade Leather Goods: Bags, Wallets, Belts | OCCUIN",
    description: "The full OCCUIN collection of leather laptop bags, totes, crossbody bags, travel bags, wallets and belts, all made to order in Pakistan.",
  },
  "/shop/leather/laptop-bags": {
    title: "Handmade Leather Laptop Bags and Briefcases | OCCUIN",
    description: "Leather laptop bags, briefcases and sleeves for 14 and 15 inch laptops, made to order in Pakistan and shipped worldwide with tracked delivery.",
  },
  "/shop/women/laptop-bags": {
    title: "Leather Laptop Bags for Women, 14 and 15 Inch | OCCUIN",
    description: "A slim pebbled leather sleeve and a rigid box calf brief for women who carry a laptop to work. Made to order in Pakistan, shipped worldwide.",
  },
  "/shop/men/laptop-bags": {
    title: "Leather Briefcases and Laptop Bags for Men | OCCUIN",
    description: "A rigid leather briefcase, a flap messenger and a slim sleeve for men who carry a laptop. Made to order in Pakistan and shipped worldwide.",
  },
  "/shop/leather/totes": {
    title: "Leather Tote and Bucket Bags, Made to Order | OCCUIN",
    description: "Open leather totes and slouched bucket bags with long handles, made to order in Pakistan and shipped worldwide with tracked delivery.",
  },
  "/shop/women/totes": {
    title: "Leather Tote Bags for Women, Handmade to Order | OCCUIN",
    description: "Roomy leather tote bags and bucket bags for women, with long handles that sit on the shoulder. Made to order in Pakistan, shipped worldwide.",
  },
  "/shop/leather/top-handle": {
    title: "Leather Top Handle Bags and Satchels to Order | OCCUIN",
    description: "Structured leather top handle bags and buckled satchels, each with a shoulder strap. Made to order in Pakistan and shipped worldwide.",
  },
  "/shop/women/top-handle": {
    title: "Top Handle Leather Bags and Satchels for Women | OCCUIN",
    description: "A croc-embossed top handle bag and a pebbled calf satchel for women, each with a shoulder strap. Made to order in Pakistan, shipped worldwide.",
  },
  "/shop/men/top-handle": {
    title: "Leather Satchels for Men, Handmade to Order | OCCUIN",
    description: "A structured leather satchel for men with twin buckles, a top handle and a shoulder strap. Made to order in Pakistan and shipped worldwide.",
  },
  "/shop/leather/crossbody": {
    title: "Leather Crossbody and Saddle Bags, Handmade | OCCUIN",
    description: "Curved leather saddle bags worn across the body, with a contrast gusset. Made to order in Pakistan and shipped worldwide with tracked delivery.",
  },
  "/shop/women/crossbody": {
    title: "Leather Crossbody Bags for Women, Made to Order | OCCUIN",
    description: "Hands-free leather crossbody bags for women, led by a curved saddle shape on a long strap. Made to order in Pakistan and shipped worldwide.",
  },
  "/shop/leather/travel": {
    title: "Leather Travel Bags and Weekenders, Handmade | OCCUIN",
    description: "Two-tone leather holdalls sized for two nights away, with a zip top and a shoulder strap. Made to order in Pakistan and shipped worldwide.",
  },
  "/shop/women/travel": {
    title: "Leather Weekender Bags for Women, Made to Order | OCCUIN",
    description: "A leather weekender bag for women with room for two nights away, a zip top and a shoulder strap. Made to order in Pakistan, shipped worldwide.",
  },
  "/shop/men/travel": {
    title: "Men's Leather Weekender Bags and Holdalls | OCCUIN",
    description: "A leather holdall for men with room for two nights away, a zip top, two handles and a shoulder strap. Made to order in Pakistan.",
  },
  "/shop/leather/wallets": {
    title: "Leather Wallets, Card Holders and Clutches | OCCUIN",
    description: "Leather wallets, zip card cases and clutches, made to order in Pakistan. Personalise a wallet with up to four monogram letters in our studio.",
  },
  "/shop/women/wallets": {
    title: "Women's Leather Wallets, Clutches and Card Cases | OCCUIN",
    description: "Leather wallets, zip card cases and a slim clutch for women, made to order in Pakistan and shipped worldwide. Add a monogram in our studio.",
  },
  "/shop/men/wallets": {
    title: "Men's Leather Wallets and Card Holders, Handmade | OCCUIN",
    description: "Leather bifold wallets and zip card holders for men, made to order in Pakistan and shipped worldwide. Add your initials in our design studio.",
  },
  "/shop/leather/belts": {
    title: "Handmade Leather Belts, Sizes 80 to 100 cm | OCCUIN",
    description: "Bridle leather belts with a solid brass pin buckle, in sizes 80 to 100 cm. Made to order in Pakistan and shipped worldwide with tracking.",
  },
  "/shop/women/belts": {
    title: "Leather Belts for Women, Handmade to Order | OCCUIN",
    description: "A tan bridle leather belt for women with punched broguing and a brass pin buckle, in sizes 80 to 100 cm. Made to order in Pakistan.",
  },
  "/shop/men/belts": {
    title: "Men's Leather Dress Belts, Handmade to Order | OCCUIN",
    description: "A brogued leather dress belt for men in tan bridle leather with a brass pin buckle, in sizes 80 to 100 cm. Made to order in Pakistan.",
  },
  "/studio": {
    title: "Design Your Own Leather Bag in 3D, Made to Order | OCCUIN",
    description: "Customise a leather bag in live 3D. Change the size, leather, stitching and hardware, add a monogram, see the price, and we make it to order.",
  },
  "/studio/create": {
    title: "Custom Leather Bag Designer: Draw Your Own | OCCUIN",
    description: "Draw your own leather piece on a pattern board, see it in 3D with a price estimate, and send it to our workshop for a final price by email.",
  },
  "/about": {
    title: "About OCCUIN: Made to Order Leather Goods from Pakistan",
    description: "OCCUIN makes leather bags, laptop bags, wallets and belts to order in Pakistan and ships them worldwide. Learn how it works and how custom orders run.",
  },
  "/care": {
    title: "How to Care for a Leather Bag: Cleaning, Storage | OCCUIN",
    description: "How to clean a leather bag, how often to condition it, what to do if it gets wet, and how to store it so it keeps its shape for years of use.",
  },
  "/shipping-returns": {
    title: "Shipping and Returns: Delivery Times, Policy | OCCUIN",
    description: `Orders arrive in ${TRACKED} tracked or ${EXPRESS} by express. Returns are accepted only if a piece arrives faulty or differs from your order.`,
  },
  "/size-guide": {
    title: "Leather Belt Size Guide and Laptop Bag Fit | OCCUIN",
    description: "Find your belt size from 80 to 100 cm with our waist chart, learn how to measure yourself, and check which laptop bag fits a 14 or 15 inch laptop.",
  },
  "/faq": {
    title: "OCCUIN FAQ: Custom Orders, Delivery, Returns, Payment",
    description: "Answers to common questions about OCCUIN: what the leather is, how custom orders work, how long delivery takes, returns, tracking and payment.",
  },
  "/contact": {
    title: "Contact OCCUIN: Orders, Returns and Custom Leather Work",
    description: "Write to OCCUIN about an order, a return, a product or a custom design. Send the form or email us, and include your order number if you have one.",
  },
  "/privacy": {
    title: "Privacy Policy: How OCCUIN Handles Your Personal Data",
    description: "What personal data OCCUIN collects, how it is used, who it is shared with, the cookies we use, and how to ask for a copy or for it to be deleted.",
  },
  "/terms": {
    title: "Terms of Sale: Orders, Payment and Returns | OCCUIN",
    description: "The terms that apply when you buy from OCCUIN, covering orders, prices, delivery, returns, studio pieces, reviews and our liability to you.",
  },
};

type ImageRef = { url: string; width?: number; height?: number; alt: string };

function buildMetadata({ title, description }: PageMeta, path: string, image: ImageRef = DEFAULT_IMAGE): Metadata {
  const url = absoluteUrl(path);
  const shared = { ...image, url: absoluteUrl(image.url) };
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: BRAND.name, type: "website", images: [shared] },
    twitter: { card: "summary_large_image", title, description, images: [shared.url] },
  };
}

export function pageMeta(path: string, imageUrl?: string): Metadata {
  const entry = META[path];
  if (!entry) throw new Error(`No SEO entry for ${path}`);
  return buildMetadata(entry, path, imageUrl ? { url: imageUrl, alt: entry.title.replace(SUFFIX, "") } : undefined);
}

function fit(candidates: string[], { min, max }: { min: number; max: number }) {
  const inRange = candidates.find((text) => text.length >= min && text.length <= max);
  if (inRange) return inRange;
  const fallback = candidates.find((text) => text.length <= max) ?? candidates[candidates.length - 1]!;
  return fallback.length <= max ? fallback : fallback.slice(0, fallback.lastIndexOf(" ", max));
}

export function categoryMeta(path: string, categoryName: string, imageUrl?: string): Metadata {
  if (META[path]) return pageMeta(path, imageUrl);
  const name = categoryName.toLowerCase();
  const who = path.startsWith("/shop/women") ? " for Women" : path.startsWith("/shop/men") ? " for Men" : "";
  const heading = `Leather ${categoryName}${who}`;
  return buildMetadata(
    {
      title: fit([`${heading}, Handmade to Order${SUFFIX}`, `${heading}, Made to Order${SUFFIX}`, `${heading}${SUFFIX}`], TITLE_RANGE),
      description: fit([`Leather ${name}${who.toLowerCase()} from OCCUIN, each piece made to order in Pakistan and shipped worldwide with tracked delivery.`, `Leather ${name}${who.toLowerCase()}, made to order in Pakistan and shipped worldwide.`], DESCRIPTION_RANGE),
    },
    path,
    imageUrl ? { url: imageUrl, alt: heading } : undefined,
  );
}

const PRODUCT_COPY: Record<string, { title: string; lead: string }> = {
  "bureau-15": { title: "Bureau 15 Leather Briefcase for 15 Inch Laptops", lead: "A rigid box calf briefcase for a 15 inch laptop, with two handles, a zip top and a detachable strap." },
  "etui-14": { title: "Etui 14 Leather Laptop Sleeve for 14 Inch Laptops", lead: "A slim zip sleeve in pebbled leather for a 14 inch laptop, lined to protect the screen." },
  "courrier-36": { title: "Courrier 36 Leather Messenger Bag for Laptops", lead: "A flap messenger bag with a wide shoulder strap, sized for a laptop and a notebook." },
  "cabas-38": { title: "Cabas 38 Pebbled Leather Tote Bag in Cognac", lead: "An open pebbled leather tote with bellows sides and long handles that softens with use." },
  "seau-24": { title: "Seau 24 Tall Leather Bucket Bag in Bordeaux", lead: "A tall leather bucket bag with a slouched top, a long handle and a shoulder strap." },
  "nocturne-28": { title: "Nocturne 28 Croc-Embossed Leather Top Handle Bag", lead: "A structured top handle bag in croc-embossed leather, with a flap, a turnlock and a detachable strap." },
  "selle-22": { title: "Selle 22 Leather Saddle Crossbody Bag in Vachetta", lead: "A curved leather saddle bag with a contrast gusset, worn across the body on a long strap." },
  "grand-tour-50": { title: "Grand Tour 50 Two-Tone Leather Weekender Bag", lead: "A two-tone leather holdall sized for two nights away, with a zip top and a shoulder strap." },
  "pochette-26": { title: "Pochette 26 Leather Zip Clutch in Bordeaux", lead: "A slim leather zip clutch that holds a phone, keys and cards, in deep Bordeaux." },
  "portefeuille-12": { title: "Portefeuille 12 Folded Leather Wallet in Espresso", lead: "A folded wallet with a flap, in smooth Espresso leather that darkens with use." },
  "carte-10": { title: "Carte 10 Leather Zip Card Case in Sapin Green", lead: "A pocket-sized leather card case with a zip, in Sapin green. Personalise it in our studio." },
  "slate-buckle-satchel": { title: "Slate Buckle Satchel in Pebbled Calf Leather", lead: "A structured satchel in pebbled calf with twin buckles, a top handle and a shoulder strap." },
  "tooled-bifold-wallet": { title: "Tooled Bifold Leather Wallet with Six Card Slots", lead: "A vegetable-tanned leather bifold wallet with six card slots that darkens with use." },
  "brogued-dress-belt": { title: "Brogued Tan Bridle Leather Dress Belt, Handmade", lead: "A bridle leather dress belt with punched broguing and a solid brass pin buckle." },
};

type ProductSummary = {
  slug: string;
  name: string;
  description: string;
  composition: string;
  categoryName: string;
  images: string[];
  variants: { priceCents: number }[];
};

export function productMeta(product: ProductSummary): Metadata {
  const copy = PRODUCT_COPY[product.slug];
  const heading = copy?.title ?? `${product.name} Leather ${product.categoryName}`;
  const lead = copy?.lead ?? product.description.replace(/full-grain\s+/gi, "");
  const price = money(Math.min(...product.variants.map((variant) => variant.priceCents)));
  const title = fit(
    [`${heading}${SUFFIX}`, `${product.name}, Handmade Leather Goods to Order${SUFFIX}`, `${product.name}, Made to Order${SUFFIX}`, `${product.name}${SUFFIX}`],
    TITLE_RANGE,
  );
  const description = fit(
    [
      `${lead} ${price}, made to order in Pakistan and shipped worldwide with tracked delivery in ${TRACKED}.`,
      `${lead} ${price}, made to order in Pakistan, arrives in ${TRACKED} tracked.`,
      `${lead} ${price}, made to order in Pakistan.`,
      `${lead} ${price}, made to order.`,
    ],
    DESCRIPTION_RANGE,
  );
  const image = product.images[0];
  return buildMetadata({ title, description }, `/product/${product.slug}`, image ? { url: image, alt: product.name } : undefined);
}

export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const COUNTRY_CODES = COUNTRIES.map((country) => country.code);

const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: COUNTRY_CODES,
  returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
  merchantReturnLink: absoluteUrl("/shipping-returns"),
  description: "Every piece is made to order, so change of mind returns are not accepted. A piece that arrives faulty or differs from the order is replaced or refunded.",
};

export const organizationData = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: BRAND.name,
  url: SITE_URL,
  logo: absoluteUrl("/logo-green.svg"),
  email: BRAND.email,
  description: "Handmade leather bags, laptop bags, wallets and belts for women and men, made to order in Pakistan and shipped worldwide.",
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: BRAND.email, url: absoluteUrl("/contact") },
  hasMerchantReturnPolicy: RETURN_POLICY,
});

export const websiteData = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: BRAND.name,
  url: SITE_URL,
  publisher: { "@id": ORGANIZATION_ID },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

export const breadcrumbData = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path) })),
});

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

export const faqData = (items: { question: string; answer: ReactNode }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: nodeText(item.answer) },
  })),
});

function shippingDetails(priceCents: number, method: ShippingMethod) {
  const [handlingMin, handlingMax] = days(MAKING_TIME);
  const [arrivalMin, arrivalMax] = days(arrival(method));
  return {
    "@type": "OfferShippingDetails",
    shippingLabel: SHIPPING_METHODS[method].label,
    shippingRate: { "@type": "MonetaryAmount", value: (shippingCents(priceCents, method) / 100).toFixed(2), currency: "USD" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: COUNTRY_CODES },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: handlingMin, maxValue: handlingMax, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: arrivalMin - handlingMin, maxValue: arrivalMax - handlingMax, unitCode: "DAY" },
    },
  };
}

const millimetres = (value: number) => ({ "@type": "QuantitativeValue", value, unitCode: "MMT" });

type ProductData = ProductSummary & {
  categoryName: string;
  studioPreset: { form: { width: number; height: number; depth: number } } | null;
};

type OfferOption = { sku: string; color: string; size: string; priceCents: number; stock: number };

export function productData(product: ProductData, options: OfferOption[], reviews: { average: number; total: number }) {
  const url = absoluteUrl(`/product/${product.slug}`);
  const form = product.studioPreset?.form;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description: product.description,
    url,
    image: product.images.map(absoluteUrl),
    sku: options[0]?.sku,
    brand: { "@type": "Brand", name: BRAND.name },
    category: product.categoryName,
    color: options[0]?.color,
    material: product.composition.split(".")[0]!.replace(/full-grain\s+/gi, "").replace(/^./, (letter) => letter.toUpperCase()),
    countryOfOrigin: { "@type": "Country", name: "Pakistan" },
    ...(form ? { width: millimetres(form.width), height: millimetres(form.height), depth: millimetres(form.depth) } : {}),
    offers: options.map((option) => ({
      "@type": "Offer",
      sku: option.sku,
      url,
      price: (option.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      itemCondition: "https://schema.org/NewCondition",
      availability: `https://schema.org/${option.stock > 0 ? "InStock" : "OutOfStock"}`,
      seller: { "@type": "Organization", "@id": ORGANIZATION_ID, name: BRAND.name },
      shippingDetails: [shippingDetails(option.priceCents, "standard"), shippingDetails(option.priceCents, "express")],
      hasMerchantReturnPolicy: RETURN_POLICY,
    })),
    ...(reviews.total
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.average.toFixed(1), reviewCount: reviews.total } }
      : {}),
  };
}
