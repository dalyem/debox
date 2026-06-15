import type { Rng } from "../../platform/rng";

/**
 * Word Rush — the bundled dictionary.
 *
 * `ANSWERS` is the pool of secret words (common, recognisable, fun to crack).
 * `EXTRA_VALID` widens the set of *accepted guesses* with more everyday words
 * plus the popular opener words (ADIEU, STARE, CRANE, RAISE …) so normal play
 * is never rejected as "not a word". Together they form `VALID_GUESSES`.
 *
 * There is no system dictionary to lean on, so this list is deliberately
 * curated rather than exhaustive: a guess outside it is rejected (classic
 * Wordle feel), but every common word a player is likely to try is included.
 * `words.test.ts` asserts every entry is exactly five lowercase letters and
 * unique, so a typo here fails the build rather than shipping a broken word.
 */

export const WORD_LENGTH = 5;

const ANSWER_SOURCE = `
about above abuse actor acute admit adopt adult after again agent agree ahead
alarm album alert alike alive allow alone along aloud alter amber among angel
anger angle angry ankle apart apple apply april arena argue arise armor aroma
array arrow aside asset audio audit avoid await awake award aware awful
bacon badge badly baker basic basin batch beach beard beast began begin begun
being belly below bench berry bezel bible bingo birch birth black blade blame
blank blast blaze bleak bleak blend bless blind blink bliss block blond blood
bloom blown blues bluff blunt blush board boast bonus boost booth bound brain
brake brand brass brave bread break breed brick bride brief bring brisk broad
broil broke brook broom brown brush buddy build built bunch burst buyer
cabin cable cacao candy canoe cargo carol carry catch cause cease chain chair
chalk champ chant chaos charm chart chase cheap cheat check cheek cheer chess
chest chewy chick chief child chili chill china chirp choir chord chose chuck
chunk churn cider cigar civic civil claim clamp clash clasp class clean clear
clerk click cliff climb cling clink cloak clock clone close cloth cloud clout
clove clown clubs coach coast cobra cocoa colon color comet comic coral couch
cough could count court cover crack craft cramp crane crash crate crawl crazy
cream creek creep crest crime crisp croak crook cross crowd crown crude cruel
crumb crush crust cured curly curry curse curve cycle
daily dairy daisy dance dandy dated dealt death debit debut decay decor delay
delta dense depot depth derby diary dimly diner dingo dirty disco ditch diver
dizzy dodge doing donor donut doubt dough dozen draft drain drama drank drawn
dread dream dress dried drift drill drink drive drone drove drown drums dryer
dusty dutch dwarf dwell
eager eagle early earth eaten ebony eight elbow elder elect elite elope email
ember empty enact enemy enjoy enter entry envoy epoch equal equip erase erode
error essay ether ethic event every evict evoke exact exalt excel exert exile
exist extra
fable faint fairy faith false fancy fatal fault feast fence ferry fetch fever
fewer fiber field fiery fifth fifty fight final finch fixed fizzy flaky flair
flake flame flank flare flash fleet flesh flick fling flint float flock flood
floor flora flour flown fluff fluid fluke flush flute foamy focus foggy force
forge forgo forte forth forty forum found frame frank fraud freak fresh fried
frill frock frost frown fruit fudge fully fungi funky funny furry fuzzy
gamer gauge gavel gecko genie genre ghost ghoul giant giddy given giver glade
gland glare glass gleam glide globe gloom glory glove glows goose grace grade
grain grand grant grape graph grasp grass grave gravy graze great greed green
greet grief grill grime grind groan groin groom grope gross group grove growl
grown gruff grump guard guava guess guest guide guild guilt gully gusto gypsy
habit hairy halve handy happy hardy harsh haste hatch haunt haven havoc hazel
heart heave heavy hedge hefty hello hence heron hinge hippo hobby holly homer
honey honor horde horse hotel hound house hover human humor humph hunch hurry
hutch hydra hyena
ideal idiom idiot igloo image imply inbox incur index inert infer inlay inner
input intro ionic irate irony issue ivory
jaunt jazzy jelly jewel joint joker jolly judge juice juicy jumbo jumpy
karma kayak kebab khaki kinky kiosk kitty knack knead kneel knelt knife knock
knoll known koala
label labor laden lance large larva laser latch later laugh layer leafy leant
leapt learn lease leash least leave ledge lemon level lever light lilac limbo
linen liner lingo liver lobby local lodge logic loose lorry loser lover lower
loyal lucky lunar lunch lupus lurch lurid lying lyric
macaw macho madam madly magic major maker mamba mango maple march marry marsh
mason match matey mauve maxim maybe mayor meant medal media melon mercy merge
merit merry messy metal meter midst might mimic mince miner minor minus mirth
mixed mocha model modem moist molar moldy money month moose moral motel motif
motor mound mount mourn mouse mouth mover movie mower mucky muddy mulch mummy
mural murky music
nadir naive nanny nasal nasty naval needy nerve never newer newly nicer niche
niece night ninja noble nobly noise noisy nomad north notch noted novel nudge
nurse nutty nylon nymph
oasis ocean offer often olive onion onset opera optic orbit order organ other
otter ought ounce outer ovary overt owner ozone
paddy paint panel panic pansy paper parka party pasta paste pasty patch patio
pause peace peach pearl pecan pedal penny perch peril perky pesky petal petty
phase phone photo piano picky piece piety piggy pilot pinch pixel pizza place
plaid plain plane plank plant plate plaza plead pluck plumb plump plush poach
point poise poker polar polka porch pound power press price pride prime print
prior prism prize probe prone proof prose proud prove prowl prune psalm pudgy
pulse punch pupil puppy puree purge purse pushy
quack quail quake qualm quark quart queen query quest queue quick quiet quill
quilt quirk quite quota quote
radar radio rainy raise rally ranch range rapid raspy raven reach react ready
realm rebel refer regal reign relax relay relic remix renew repay reply rerun
reset resin rhino rhyme rider ridge rifle right rigid rinse rival river roast
robin robot rocky rouge rough round route royal rugby ruler rumor rural rusty
saint salad sally salsa salty sandy sauce sauna saute savor savvy scald scale
scalp scaly scamp scant scare scarf scary scene scent scoff scold scone scoop
scope score scorn scour scout scowl scram scrap screw scrub seize sense serve
setup seven sever shack shade shady shaft shake shaky shale shall shame shape
share shark sharp shave sheen sheep sheer sheet shelf shell shift shine shiny
shirt shoal shock shone shore short shout shove shown showy shred shrub shrug
shush shyly sight silky silly since sinew siren sixth sixty skate skiff skill
skirt skulk skull skunk slang slant slash slate sleek sleep sleet slept slice
slick slide slime slope sloth slump slung slush small smart smash smear smell
smile smirk smoke smoky snack snail snake snare sneak sneer sniff snipe snore
snort snout snowy snuck soapy sober solar solid solve sonic sorry sound south
space spade spank spare spark spawn speak spear speck speed spell spend spent
spice spicy spike spill spine spire spite splat split spoke spool spoon spore
sport spout spray spree sprig spurn spurt squad squat squid stack staff stage
stain stair stake stale stalk stall stamp stand stare stark start stash state
steak steal steam steel steep steer stern stick stiff still sting stink stock
stoic stomp stone stony stood stool stoop store stork storm story stout stove
strap straw stray strip strut study stuff stump stung stunt style suave sugar
suite sunny super surge swamp swarm swear sweat sweep sweet swell swept swift
swing swirl swish sword swore sworn swung syrup
table taboo tacit tacky taffy taken tally tango tangy taper tardy taste taunt
teach tease teddy tempo tenor tense tepid thank theft their theme there these
thick thief thigh thing think third thong thorn those three threw throb throw
thumb thump tiara tidal tiger tight tilde timer timid tipsy title toast today
token tonal tonic tooth topaz topic torch total touch tough towel tower toxic
trace track trade trail train trait tramp trash tread treat trend trial tribe
trick tried tripe troll troop trout truce truck truly trump trunk trust truth
tulip tumor tunic turbo tutor twang tweak tweed tweet twice twine twirl twist
udder ulcer ultra umbra uncle uncut under undid undue unfit unify union unite
unity unzip upper upset urban usage usher usual usurp utter
vague valet valid value valve vapor vault vegan venom venue verge verse vicar
video vigor villa vinyl viola viper viral virus visit visor vista vital vivid
vocal vodka vogue voice vouch vowel
wacky wafer wager wagon waist waltz waste watch water weary weave wedge weigh
weird whale wharf wheat wheel where which while whine whirl whisk white whole
whoop whose widen width wield wimpy wince winch windy wiper wispy witch woken
woman world worry worse worst worth would wound woven wrack wrath wreak wreck
wrist write wrong wrote wrung
yacht yearn yeast yield yodel young youth yummy
zebra zesty zonal
`;

const EXTRA_SOURCE = `
adieu audio aisle arose atone azure beget belie binge blare bloat bough brine
briny broth brunt bugle bulky bumpy burnt bushy cadet cadre cameo carat caret
carte cater chime chump clang clack clamp cleat cleft clerk clung coyly crank
crass creak credo creed crepe cress crock croft croon cumin daunt decoy deign
deity demon demur depot dingy dogma dowel downy dowry dryly eaves elude embed
endow ennui ensue erupt ester ethos evade exult facet fjord feign felon femur
fetal fetid filer filet filmy filth fiord flier flirt floss flung flunk foray
freed frisk frizz frond gaffe gamma gaudy gaunt gauze gawky genus girth glaze
glean glint gloat gloss glyph gnash gnome godly golem gonad gorge gouge gourd
grail grime groan grout grimy groom growl gruel grunt guile gulch gully gusty
gutsy hardy harem hasty heady heath heist helix hertz homey hooch hoard hoary
hoist howdy hubby hunky husky hyper icily icing idler iliac inane inapt ingot
inlet irked jaunt jetty jiffy jingo joust joule juror kappa kefir kinky kiosk
knave knurl labor lager lanky lapse lardy lathe leech leery legit lemur liege
livid llama loamy loath lofty lumen lumpy lunge lurid lusty lymph macaw madly
mange manor masse matey mealy meaty mecca melee meaty metro midge miser mocha
moldy mossy motto mould moult mourn mucky musky musty natal neigh nerdy newer
nicer ninny nippy noisy nomad nosey nudge oaken oaten octet odder odium ombre
omega ovate ozone paler palsy parry pasty payee perky pesky pewit phony pibal
pinch piney pinky piper pique pivot plaid plait plank pleat plied plier plonk
plonk poesy polyp poppy posse pouch poult pouty primp privy prong proxy prude
prune psalm pshaw pudgy puffy pulpy punky pushy quack quaff quail qualm quark
rabid radii ramen randy raspy ratty raven rebar recap recur reedy regal rehab
relic renal repel resin retch rhino ricer rigor riper ripen risen risky rivet
roomy roost rotor rouse rowdy ruddy runic runny saber sadly samba sappy sassy
satyr saute savvy scald scaly scamp scant scarf scary scion scoff scold scone
scorn scour scowl scram scree scrum sedge segue seman serif serum sever shale
shalt shank shard sheen shire shorn shoes shrew shuck shunt sieve silty since
sinew singe skein skiff skimp skulk slack slain slang slosh slung slunk slyly
smear smelt smirk smith smock smote snare snarl snide sniff snoop snore snort
snout snowy snuck soapy sober soggy sonar sooty souse sowar spasm spawn spelt
spied spiel spiny splat spoof spook spool spore sprig sprat spunk spurn squib
stein stilt stoic stoke stomp stoop stout strut stump stung stunk suave sully
sumac sunup surly swami swash swath swirl swoon swoop tabby taboo tacit tally
talon tamer tangy tardy tarot taunt teary teddy tepee tepid terse testy thane
theta thorn thyme tiara tidal tilde timid tipsy tithe toddy tonal topaz torso
totem toxin trawl trews triad tripe trite troll trope trove truce tryst tubby
tunic turbo tweak tweed tweet twang twirl twixt tying udder ulcer umbra unbox
uncut undid unfed unfit unify unlit unmet unpin unset untie unwed unzip urine
usurp uvula vapid vegan venom verge vicar vigil vinyl viola viper visor vista
vodka vouch vroom wacky wader wafer waged wager waltz waver waxen weave welch
welsh wench whack wharf whelp whiff whine whiny whisk wider wield wimpy wince
winch windy wiper wispy wooer woody wooly wordy wrack wrath wreak wring wrung
wryly yahoo yokel yucky zappy zilch zippy zonal
`;

function parse(source: string): string[] {
  return source.trim().split(/\s+/).filter(Boolean);
}

export const ANSWERS: string[] = Array.from(new Set(parse(ANSWER_SOURCE)));

/** Every word accepted as a guess: answers plus the extra common/opener words. */
export const VALID_GUESSES: ReadonlySet<string> = new Set([
  ...ANSWERS,
  ...parse(EXTRA_SOURCE),
]);

/** Normalize a raw guess to the canonical lowercase form for lookup. */
export function normalizeGuess(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Is `raw` a five-letter word we accept as a guess? */
export function isValidGuess(raw: string): boolean {
  const w = normalizeGuess(raw);
  return new RegExp(`^[a-z]{${WORD_LENGTH}}$`).test(w) && VALID_GUESSES.has(w);
}

/**
 * Deterministically pick a secret answer (UPPERCASE), avoiding any in
 * `exclude`. Falls back to the full pool if everything has been used.
 */
export function pickAnswer(rng: Rng, exclude: readonly string[] = []): string {
  const used = new Set(exclude.map((w) => w.toLowerCase()));
  const pool = ANSWERS.filter((w) => !used.has(w));
  const list = pool.length > 0 ? pool : ANSWERS;
  return list[rng.int(list.length)]!.toUpperCase();
}
