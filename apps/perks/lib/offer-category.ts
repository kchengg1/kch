import type { OfferCategory } from "@kch/perks-types";
import { classify, type Category as EarnCategory } from "./earn";

export type { OfferCategory };

export const OFFER_CATEGORIES: { id: OfferCategory; label: string }[] = [
  { id: "travel", label: "Travel" },
  { id: "dining", label: "Food & dining" },
  { id: "shopping", label: "Shopping" },
  { id: "entertainment", label: "Entertainment" },
  { id: "health", label: "Health & beauty" },
  { id: "home", label: "Home & pets" },
  { id: "services", label: "Services" },
  { id: "other", label: "Other" },
];

export const OFFER_CATEGORY_LABEL: Record<OfferCategory, string> = Object.fromEntries(
  OFFER_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<OfferCategory, string>;

export const OFFER_CATEGORY_ORDER: Record<OfferCategory, number> = Object.fromEntries(
  OFFER_CATEGORIES.map((c, i) => [c.id, i]),
) as Record<OfferCategory, number>;

export function isOfferCategory(value: string | undefined): value is OfferCategory {
  return Boolean(value && value in OFFER_CATEGORY_LABEL);
}

const EARN_TO_OFFER: Partial<Record<EarnCategory, OfferCategory>> = {
  hotels: "travel",
  flights: "travel",
  transit: "travel",
  travel: "travel",
  gas: "travel",
  dining: "dining",
  groceries: "dining",
  wholesale: "dining",
  streaming: "entertainment",
  drugstores: "health",
  phone: "services",
  office: "services",
  shipping: "services",
};

/**
 * Broad merchant-name rules ordered from most specific to most general.
 * Checked before `earn.ts`'s `classify()` fallback and details keywords.
 */
const MERCHANT_RULES: [RegExp, OfferCategory][] = [
  // Travel: hotels, airlines, car rentals, transit, gas & EV charging, cruises, OTAs
  [
    /\b(hyatt|andaz|marriott|westin|sheraton|ritz[- ]?carlton|st\.?\s*regis|courtyard|aloft|bonvoy|hilton|hampton|conrad|waldorf|doubletree|embassy suites|ihg|holiday inn|intercontinental|kimpton|crowne plaza|best western|four seasons|fairmont|sofitel|wyndham|radisson|omni hotel|loews|mandarin oriental|mgm|caesars|wynn|airbnb|vrbo|expedia|booking\.com|priceline|hotels?\.com|hotwire|tripadvisor|resort|inn\b|hotel|lodge|suites?\b|motel)/i,
    "travel",
  ],
  [
    /\b(emirates|delta|united|southwest|jetblue|alaska air|hawaiian air|american airlines|air canada|british airways|air france|klm|lufthansa|qatar|singapore air|cathay|qantas|etihad|virgin atlantic|spirit|frontier|airline|airways|aviation|clear\b|priority pass|lounge)/i,
    "travel",
  ],
  [
    /\b(lyft|uber(?!\s*eats)|turo|hertz|avis|enterprise|national car|alamo|budget|sixt|zipcar|amtrak|brightline|cruise|royal caribbean|norwegian|carnival|celebrity|princess|viking|sunoco|shell|exxon|chevron|mobil|bp\b|circle k|speedway|wawa|evgo|chargepoint|electrify america|high-power charging|supercharger|parking|spothero|parkwhiz|toll)/i,
    "travel",
  ],

  // Food & dining: restaurants, cafes, fast casual, bars, meal kits, wine/alcohol, snacks, groceries
  [
    /\b(restaurant|bistro|cafe|café|coffee|espresso|roaster|bakery|bakehouse|bagel|donut|doughnut|pizza|pizzeria|burger|smashburger|shake shack|five guys|in-n-out|potbelly|chipotle|sweetgreen|cava|panera|starbucks|dunkin|peet'?s|la colombe|blue bottle|chicken|wings|taco|taqueria|sushi|ramen|noodle|thai|steakhouse|grill|diner|tavern|pub\b|bar\b|kitchen|eatery|cantina|trattoria|osteria|brasserie|chophouse|seafood|bbq|barbecue|deli\b|sandwich|ice cream|gelato|chuck e\.?\s*cheese|cheesecake factory|olive garden|ruth'?s chris|morton'?s|fogo de chao|nobu|resy|opentable|tock\b)/i,
    "dining",
  ],
  [
    /\b(doordash|ubereats|uber eats|grubhub|postmates|seamless|instacart|ezcater|wonder\b|blue apron|home chef|hellofresh|factor\b|hungryroot|daily harvest|misfits market|nurture life|cookunity|gobble|green chef|everyplate|freshdirect|goldbelly|wild alaskan|butcherbox|omaha steaks|crowd cow|nuts\.com|tiff'?s treats|levain|crumbl|milk bar|harry & david|edible arrangements|chocolate|candy|snack|treats|grocery|supermarket|whole foods|trader joe|safeway|kroger|wegmans|publix|aldi|h-?mart|sprouts|sam'?s club|costco|bj'?s)/i,
    "dining",
  ],
  [
    /\b(wine|winery|winc\b|chandon|scout & cellar|total wine|bevmo|drizly|reservebar|flaviar|brewery|distillery|spirits|liquor|champagne|cocktail|cider)/i,
    "dining",
  ],

  // Entertainment & media: streaming, TV, live tickets, news/magazines, language learning, games
  [
    /\b(youtube|disney\+|disney plus|paramount\+|paramount plus|espn|sling tv|fubo|directv|dish network|netflix|hulu|peacock|max\b|hbo|spotify|apple tv|apple music|siriusxm|audible|kindle|tidal|crunchyroll|starz|showtime|discovery\+|amc\+|britbox|masterclass|nebula|ms now)/i,
    "entertainment",
  ],
  [
    /\b(event tickets|ticketsmarter|ticketmaster|stubhub|vivid seats|seatgeek|gametime|fandango|amc theat|regal|cinemark|alamo drafthouse|broadway|live nation|museum|zoo\b|aquarium|theme park|six flags|seaworld|topgolf|bowling|golf course)/i,
    "entertainment",
  ],
  [
    /\b(the economist|new york times|nytimes|wall street journal|wsj|washington post|the athletic|atlantic|new yorker|barron'?s|bloomberg|babbel|pimsleur|duolingo|rosetta stone|coursera|udemy|skillshare|playstation|xbox|nintendo|steam\b)/i,
    "entertainment",
  ],

  // Health, fitness & beauty: workouts, fitness gear, skincare, cosmetics, supplements, wellness
  [
    /\b(tonal|nordictrack|peloton|club pilates|pure barre|stretchlab|orangetheory|soulcycle|equinox|lifetime|planet fitness|barry'?s|solidcore|f45|corepower|ymca|classpass|therabody|hyperice|whoop|oura|johnson fitness|fitness|gym\b|pilates|yoga|massage envy|spa\b|salon|barber|weight watchers|noom|ww\b)/i,
    "health",
  ],
  [
    /\b(ag1|huel|iherb|quest\b|athletic greens|ritual|seed\b|care\/of|liquid i\.?v\.?|lmnt|vital proteins|gnc\b|vitamin|supplement|nutrition|protein|musely|hims|hers|ro\b|nurx|curology|cvs|walgreens|rite aid|duane reade|pharmacy|drugstore|myeyedr|dental|clinic|health|wellness)/i,
    "health",
  ],
  [
    /\b(beauty|skincare|cosmetic|makeup|fragrance|perfume|sephora|ulta|elizabeth arden|valentino beauty|la roche-posay|skinceuticals|osea|merit beauty|glossier|kiehl'?s|clinique|estee lauder|lancome|charlotte tilbury|fenty|drunk elephant|tatcha|supergoop|olaplex|aesop|l'?occitane|dyson|braun|shave|razor|grooming)/i,
    "health",
  ],

  // Home & pets: mattresses, furniture, appliances, kitchen, garden, smart home, pest, pets
  [
    /\b(mattress|plushbeds|sleep number|casper|purple|saatva|tempur|helix sleep|brooklinen|parachute|cozy earth|boll & branch|la-z-boy|wayfair|west elm|pottery barn|crate & barrel|cb2|williams sonoma|restoration hardware|ikea|ashley furniture|article\b|joybird|burrow|home depot|lowe'?s|ace hardware|menards|container store|rugs?\b|carpet|lighting|furniture|bedding)/i,
    "home",
  ],
  [
    /\b(bissell|irobot|roomba|shark\b|ninja\b|oxo\b|moen|kohler|gardyn|kitchenaid|breville|vitamix|le creuset|all-clad|caraway|our place|arlo\b|ring\b|simplisafe|adt\b|nest\b|terminix|ehrlich|orkin|american home shield|home warranty|pest|lawn|garden|plumbing|hvac|appliances?|kitchen)/i,
    "home",
  ],
  [
    /\b(farmer'?s dog|justfoodfordogs|ollie\b|nom nom|chewy|petco|petsmart|barkbox|whisker|litter-robot|fi\b|rover|wag\b|pet\b|pets\b|dog\b|dogs\b|cat\b|cats\b|vet\b|veterinary)/i,
    "home",
  ],

  // Services, telecom & business: wireless, internet, cloud/software, legal, shipping, insurance
  [
    /\b(visible|verizon|total wireless|straight talk|metro by t|t-?mobile|at&t|mint mobile|us mobile|google fi|cricket|boost mobile|optimum|comcast|xfinity|spectrum|cox\b|frontier fiber|starlink|wireless|internet|cellular|telecom)/i,
    "services",
  ],
  [
    /\b(dropbox|keeper security|1password|nordvpn|expressvpn|surfshark|norton|mcafee|bitwarden|adobe|microsoft|google workspace|google one|icloud|notion|canva|figma|zoom\b|slack|docusign|squarespace|shopify|godaddy|namecheap|cloudflare|aws\b|github|openai|anthropic|quickbooks|turbotax|h&r block|taxact|intuit)/i,
    "services",
  ],
  [
    /\b(legalzoom|trust & will|rocket lawyer|regus|wework|faire\b|aarp|aaa\b|fedex|ups\b|usps|dhl\b|staples|office depot|officemax|vistaprint|moo\b|insurance|geico|progressive|lemonade|state farm|allstate|moving|storage|public storage|u-haul|pod\b|tax|accounting|legal|payroll)/i,
    "services",
  ],

  // Shopping: apparel, footwear, retail, electronics, jewelry, sports gear, gifts & flowers
  [
    /\b(lululemon|fanatics|skims|calvin klein|cole haan|michael kors|ariat|nobull|brunt|harper wilde|paka|primark|tommy john|kicks crew|new balance|nike|adidas|under armour|alo yoga|vuori|patagonia|north face|rei\b|columbia|allbirds|hoka|on running|brooks|converse|vans\b|puma|reebok|ugg|birkenstock|crocs|rothy'?s|everlane|madewell|j\.?\s*crew|banana republic|gap\b|old navy|uniqlo|zara|h&m|abercrombie|anthropologie|free people|urban outfitters|ralph lauren|brooks brothers|bonobos|untuckit|charles tyrwhitt|coach|kate spade|tory burch|gucci|prada|burberry|levis|levi'?s|wrangler|carhartt|dickies|bombas|stance|mack weldon|thirdlove|spanx|victoria'?s secret|grudrun sjoden|apparel|clothing|workwear|footwear|shoes|sneaker|boots|denim|menswear|womenswear)/i,
    "shopping",
  ],
  [
    /\b(nordstrom|bloomingdale|saks|neiman marcus|macy'?s|dillard'?s|kohl'?s|target|walmart|amazon|ebay|gilt\b|whatnot|hsn\b|qvc\b|etsy|poshmark|mercari|best buy|b&h|micro center|newegg|sony|hp\.com|dell\b|lenovo|apple store|samsung|meta store|bose|sonos|garmin|gopro|canon|nikon|anker|electronics|tech for)/i,
    "shopping",
  ],
  [
    /\b(pandora|brilliant earth|tiffany|mejuri|kendra scott|david yurman|blue nile|james allen|kay jewelers|zales|swatch|fossil|jewelry|watch|diamond|zenni|lensdirect|warby parker|ray-ban|sunglass|eyewear|optical|contacts|stanley|hydro flask|yeti\b|rtic|taylormade|club champion|callaway|titleist|dick'?s sporting|golf|lectric|ebike|bike|bicycle|hallmark|teleflora|bloomsybox|1-800-flowers|ftd\b|bouqs|urbanstems|florist|flowers|sharper image|uncommon goods|cakes body|coterie|ford accessories|autozone|advance auto|o'?reilly|tire|accessories|gifts?)/i,
    "shopping",
  ],
];

/** Keyword fallback on the deal details text when the merchant name is unfamiliar. */
const DETAILS_RULES: [RegExp, OfferCategory][] = [
  [
    /\b(hotel|stay|room rate|resort|flight|airline|airfare|car rental|cruise|rideshare|gas station|fuel|ev charging|parking)\b/i,
    "travel",
  ],
  [
    /\b(dining|restaurant|food delivery|meal|coffee|grocery|groceries|wine|bakery|cafe)\b/i,
    "dining",
  ],
  [
    /\b(streaming|subscription|tv|tickets?|concert|movie|theater|theatre|magazine|newspaper)\b/i,
    "entertainment",
  ],
  [
    /\b(fitness|gym|workout|skincare|beauty|wellness|pharmacy|supplement|vitamin|massage|spa)\b/i,
    "health",
  ],
  [/\b(mattress|furniture|home improvement|pet food|appliances?|bedding|pest control)\b/i, "home"],
  [
    /\b(wireless|phone bill|internet|cable|software|cloud|vpn|insurance|legal|shipping|office supply)\b/i,
    "services",
  ],
  [/\b(apparel|clothing|shoes|footwear|jewelry|electronics|eyewear|flowers|gifts?)\b/i, "shopping"],
];

/** Broad category inferred from a merchant name and optional deal details. */
export function offerCategory(merchant: string, details = ""): OfferCategory {
  const name = merchant.trim();
  for (const [re, cat] of MERCHANT_RULES) {
    if (re.test(name)) return cat;
  }
  const earned = classify(name).category;
  const mapped = EARN_TO_OFFER[earned];
  if (mapped) return mapped;

  if (details) {
    for (const [re, cat] of DETAILS_RULES) {
      if (re.test(details)) return cat;
    }
  }
  return "other";
}
