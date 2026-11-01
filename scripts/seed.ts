import { sql } from "drizzle-orm";
import { hashPassword } from "../src/lib/server/auth";
import { closeDb, db, schema } from "../src/lib/server/db";
import { PRESETS, type PresetKey } from "../src/lib/studio/presets";
import { quoteDesign } from "../src/lib/studio/pricing";
import { COLORS } from "../src/lib/studio/spec";

type Seed = {
  slug: string;
  name: string;
  category: string;
  price: number;
  color: string;
  sizes?: string[];
  images: string[];
  description: string;
  composition: string;
  featured?: boolean;
  preset?: PresetKey;
  audiences?: string[];
};

const WOMEN = ["XS", "S", "M", "L", "XL"];
const MEN = ["S", "M", "L", "XL", "XXL"];
const JACKET = ["44", "46", "48", "50", "52", "54"];
const BELT = ["80", "85", "90", "95", "100"];
const ONE = ["One size"];

const CATEGORIES = [
  ["women-coats", "Coats", "women"],
  ["women-dresses", "Dresses", "women"],
  ["women-knitwear", "Knitwear", "women"],
  ["women-tops", "Tops", "women"],
  ["men-tailoring", "Tailoring", "men"],
  ["men-outerwear", "Outerwear", "men"],
  ["men-shirts", "Shirts and tees", "men"],
  ["men-knitwear", "Knitwear", "men"],
  ["leather-laptop-bags", "Laptop bags", "leather"],
  ["leather-totes", "Totes", "leather"],
  ["leather-top-handle", "Top handle", "leather"],
  ["leather-crossbody", "Crossbody", "leather"],
  ["leather-travel", "Travel", "leather"],
  ["leather-wallets", "Wallets and cards", "leather"],
  ["leather-belts", "Belts", "leather"],
  ["leather-jackets", "Jackets", "leather"],
] as const;

const WOMEN_ONLY = ["women"];
const MEN_ONLY = ["men"];
const rendered = (key: PresetKey, category: string, description: string, audiences?: string[], featured = false): Seed => ({
  audiences,
  slug: PRESETS[key].name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name: PRESETS[key].name,
  category,
  price: quoteDesign(PRESETS[key]).totalCents,
  color: COLORS[PRESETS[key].panels.primary.color].name,
  images: [`/images/studio/${key}.webp`],
  description,
  composition: "Full-grain leather, solid metal fittings. Made in Pakistan",
  featured,
  preset: key,
});

const PRODUCTS: Seed[] = [
  rendered("laptop", "leather-laptop-bags", "A rigid brief in box calf that holds a 15 inch laptop, with two handles, a zip top and a detachable strap.", undefined, true),
  rendered("sleeve", "leather-laptop-bags", "A slim zip sleeve in pebbled leather for a 14 inch laptop. Lined to protect the screen."),
  rendered("messenger", "leather-laptop-bags", "A flap messenger with a wide shoulder strap, sized for a laptop and a notebook.", MEN_ONLY),
  rendered("tote", "leather-totes", "An open tote in pebbled leather with bellows sides and long handles. It softens with every use.", WOMEN_ONLY, true),
  rendered("bucket", "leather-totes", "A tall bucket bag with a slouched top and a long handle.", WOMEN_ONLY),
  rendered("satchel", "leather-top-handle", "A structured top handle in croc-embossed leather, with a flap, a turnlock and a detachable strap.", WOMEN_ONLY, true),
  rendered("crossbody", "leather-crossbody", "A curved saddle bag with a contrast gusset, worn across the body.", WOMEN_ONLY, true),
  rendered("weekender", "leather-travel", "A two-tone holdall sized for two nights away, with a zip top and a shoulder strap.", undefined, true),
  rendered("pouch", "leather-wallets", "A slim zip clutch that holds a phone, keys and cards.", WOMEN_ONLY),
  rendered("billfold", "leather-wallets", "A folded wallet with a flap, in smooth leather that darkens with use.", MEN_ONLY),
  rendered("cardcase", "leather-wallets", "A pocket-sized card case with a zip."),
  { slug: "belted-wrap-coat", name: "Belted Wrap Coat", category: "women-coats", price: 89000, color: "Camel", sizes: WOMEN, images: ["/images/coat-camel.webp"], description: "A double-faced wool wrap with a soft shawl lapel and a self belt. Cut long and close through the waist.", composition: "90% wool, 10% cashmere", featured: true },
  { slug: "funnel-neck-coat", name: "Funnel Neck Coat", category: "women-coats", price: 96000, color: "Bordeaux", sizes: WOMEN, images: ["/images/coat-bordeaux.webp"], description: "Heavy melton with a high funnel neck and concealed fastening. Built for real winters.", composition: "100% virgin wool", featured: true },
  { slug: "long-tailored-coat", name: "Long Tailored Coat", category: "women-coats", price: 82000, color: "Rose", sizes: WOMEN, images: ["/images/coat-rose.webp"], description: "A clean single-breasted coat in brushed wool, with a straight fall to the calf.", composition: "80% wool, 20% polyamide" },
  { slug: "oversized-tartan-coat", name: "Oversized Tartan Coat", category: "women-coats", price: 78000, color: "Bottle green", sizes: WOMEN, images: ["/images/blazer-tartan.webp"], description: "A generous dropped-shoulder coat in a woven tartan, lined in silk twill.", composition: "100% wool, lining 100% silk" },
  { slug: "pleated-evening-gown", name: "Pleated Evening Gown", category: "women-dresses", price: 124000, color: "Scarlet", sizes: WOMEN, images: ["/images/gown-scarlet.webp"], description: "Liquid crepe, sun-pleated from the hip. The skirt moves with every step.", composition: "100% silk crepe", featured: true },
  { slug: "off-shoulder-gown", name: "Off-Shoulder Gown", category: "women-dresses", price: 98000, color: "Plum", sizes: WOMEN, images: ["/images/gown-plum.webp"], description: "Fitted velvet with a folded off-shoulder neckline and a clean column skirt.", composition: "82% viscose, 18% silk" },
  { slug: "polka-puff-blouse", name: "Polka Puff Blouse", category: "women-tops", price: 34000, color: "Blush", sizes: WOMEN, images: ["/images/blouse-floral.webp"], description: "Ruffled organza sleeves on a sheer dotted silk. Wear it open at the shoulder.", composition: "100% silk" },
  { slug: "chevron-intarsia-jumper", name: "Chevron Intarsia Jumper", category: "women-knitwear", price: 42000, color: "Tobacco", sizes: WOMEN, images: ["/images/chevron-knit.jpg"], description: "A bold chevron worked in two tones of lambswool, boxy through the body.", composition: "100% lambswool" },
  { slug: "brushed-crew-sweatshirt", name: "Brushed Crew Sweatshirt", category: "women-knitwear", price: 24000, color: "Saffron", sizes: WOMEN, images: ["/images/knit-saffron.webp"], description: "A loopback fleece crew in a saturated saffron, garment dyed for depth.", composition: "100% organic cotton" },
  { slug: "fringed-knit-poncho", name: "Fringed Knit Poncho", category: "women-knitwear", price: 36000, color: "Ecru", sizes: ONE, images: ["/images/poncho-ecru.webp"], description: "Open-work cotton finished with a hand-knotted fringe.", composition: "100% cotton" },

  { slug: "navy-two-piece-suit", name: "Navy Two-Piece Suit", category: "men-tailoring", price: 148000, color: "Navy", sizes: JACKET, images: ["/images/suit-navy.webp"], description: "A half-canvassed suit in Super 120s wool, with a soft shoulder and slim trouser.", composition: "100% wool", featured: true },
  { slug: "windowpane-three-piece", name: "Windowpane Three-Piece", category: "men-tailoring", price: 172000, color: "Cobalt check", sizes: JACKET, images: ["/images/suit-check.webp"], description: "Jacket, waistcoat and trouser in a cobalt windowpane flannel.", composition: "100% wool flannel" },
  { slug: "midnight-dinner-suit", name: "Midnight Dinner Suit", category: "men-tailoring", price: 164000, color: "Midnight", sizes: JACKET, images: ["/images/suit-midnight.webp"], description: "Barathea wool in a blue so deep it reads black after dark.", composition: "100% wool", featured: true },
  { slug: "soft-camel-blazer", name: "Soft Camel Blazer", category: "men-tailoring", price: 79000, color: "Camel", sizes: JACKET, images: ["/images/blazer-camel.webp"], description: "An unstructured blazer in camel hair, unlined and light on the shoulder.", composition: "100% camel hair" },
  { slug: "poplin-dress-shirt", name: "Poplin Dress Shirt", category: "men-shirts", price: 19000, color: "White", sizes: MEN, images: ["/images/shirt-white.webp"], description: "Two-fold cotton poplin with a semi-spread collar and mother of pearl buttons.", composition: "100% cotton" },
  { slug: "heavyweight-tee", name: "Heavyweight Tee", category: "men-shirts", price: 9500, color: "White", sizes: MEN, images: ["/images/tee-white.webp"], description: "A dense jersey tee that holds its shape, wash after wash.", composition: "100% organic cotton" },
  { slug: "shawl-collar-cardigan", name: "Shawl Collar Cardigan", category: "men-knitwear", price: 46000, color: "Charcoal", sizes: MEN, images: ["/images/knit-shawl.webp"], description: "A chunky rib with a full shawl collar and horn buttons.", composition: "70% wool, 30% alpaca" },
  { slug: "waxed-field-jacket", name: "Waxed Field Jacket", category: "men-outerwear", price: 62000, color: "Olive", sizes: MEN, images: ["/images/jacket-field.webp"], description: "Waxed cotton with four bellows pockets and a stowable hood.", composition: "100% waxed cotton" },
  { slug: "satin-bomber", name: "Satin Bomber", category: "men-outerwear", price: 38000, color: "Rust", sizes: MEN, images: ["/images/bomber-rust.webp"], description: "A clean flight bomber in washed satin with ribbed cuffs.", composition: "100% polyamide" },
  { slug: "shearling-denim-jacket", name: "Shearling Denim Jacket", category: "men-outerwear", price: 54000, color: "Washed blue", sizes: MEN, images: ["/images/denim-shearling.jpg"], description: "Selvedge denim lined in natural shearling at the collar and body.", composition: "100% cotton, lining 100% shearling" },

  { slug: "noir-biker-jacket", name: "Noir Biker Jacket", category: "leather-jackets", price: 24900, color: "Noir", sizes: JACKET, images: ["/images/biker-noir.webp"], description: "Vegetable-tanned lamb, cut as a classic asymmetric biker. It softens to you within a season.", composition: "100% lamb leather", featured: true },
  { slug: "cognac-moto-jacket", name: "Cognac Moto Jacket", category: "leather-jackets", price: 23900, color: "Cognac", sizes: JACKET, images: ["/images/biker-cognac.webp"], description: "Aniline-dyed nappa in a warm cognac, with antique silver zips.", composition: "100% calf leather", featured: true },
  { slug: "slate-buckle-satchel", name: "Slate Buckle Satchel", category: "leather-top-handle", price: 16900, color: "Slate", sizes: ONE, images: ["/images/grey-satchel.jpg"], description: "A structured satchel in pebbled calf with twin buckles and a top handle.", composition: "100% calf leather, brass fittings", preset: "satchel" },
  { slug: "rouge-top-handle", name: "Rouge Top Handle", category: "leather-top-handle", audiences: WOMEN_ONLY, price: 18900, color: "Rouge", sizes: ONE, images: ["/images/red-top-handle.jpg"], description: "High-shine patent calf on a rigid frame, with a polished turnlock.", composition: "100% calf leather, palladium fittings", preset: "satchel" },
  { slug: "tooled-bifold-wallet", name: "Tooled Bifold Wallet", category: "leather-wallets", price: 3900, color: "Espresso", sizes: ONE, images: ["/images/brown-wallet.jpg"], description: "Hand-burnished vegetable-tanned leather with six card slots. It darkens with use.", composition: "100% cow leather", preset: "cardcase" },
  { slug: "brogued-dress-belt", name: "Brogued Dress Belt", category: "leather-belts", price: 4500, color: "Tan", sizes: BELT, images: ["/images/tan-belt.jpg"], description: "Bridle leather with hand-punched broguing and a solid brass pin buckle.", composition: "100% bridle leather" },
];

async function seed() {
  await db.execute(sql`truncate table products, categories, promo_codes restart identity cascade`);
  await db.insert(schema.categories).values(
    CATEGORIES.map(([slug, name, department], position) => ({ slug, name, department, position })),
  );

  const now = Date.now();
  for (const [index, item] of PRODUCTS.entries()) {
    const [product] = await db
      .insert(schema.products)
      .values({
        slug: item.slug,
        name: item.name,
        description: item.description,
        composition: item.composition,
        categorySlug: item.category,
        images: item.images,
        featured: item.featured ?? false,
        audiences: item.audiences ?? ["women", "men"],
        active: item.category.startsWith("leather") && item.category !== "leather-jackets",
        studioPreset: item.preset ? PRESETS[item.preset] : null,
        createdAt: new Date(now - index * 3_600_000),
      })
      .returning();
    const sizes = item.sizes ?? ONE;
    await db.insert(schema.variants).values(
      sizes.map((size, sizeIndex) => ({
        productId: product!.id,
        sku: `${item.slug}-${size}`.toUpperCase().replace(/\s+/g, ""),
        color: item.color,
        size,
        priceCents: item.price,
        stock: sizes.length > 1 && (index + sizeIndex * 3) % 7 === 0 ? 0 : 4 + ((index * 5 + sizeIndex * 3) % 12),
      })),
    );
  }

  await db.insert(schema.promoCodes).values({ code: "WELCOME10", percentOff: 10 });

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password && password.length >= 12) {
    await db
      .insert(schema.users)
      .values({ email, name: "Store Admin", passwordHash: await hashPassword(password), role: "admin" })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${PRODUCTS.length} products.`);
  await closeDb();
}

await seed();
