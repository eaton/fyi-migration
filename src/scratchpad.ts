// import { AllWorkMigrator } from "./work/all-work.js";
// await new AllWorkMigrator({ logger: { level: 'debug' } }).run();
import jetpack from "@eatonfyi/fs-jetpack";
import { getCoverArt } from "./util/get-cover-art.js";
import { toSlug } from "@eatonfyi/text";

const downloads = {
  "1739947126": "Gaming/astate_corebook_ver1.1_HNW8002.pdf",
  "Beak, Feather, and Bone": "Gaming/Beak Feather and Bone/Beak Feather and Bone - Digital and Print.pdf",
  "Boy Problems": "Gaming/Boy Problems.pdf",
  "ENTITY": "Gaming/Candlenaut/ENTITY.pdf",
  "Cypher System Rule Book": "Gaming/Cypher-System-Rulebook-Revised-Hyperlinked-and-Bookmarked-2019-10-22.pdf",
  "Dangerous Destinations": "Gaming/Dangerous_Destinations.pdf",
  "Defiant": "Gaming/Defiant/Defiant - RPG print.pdf",
  "Dialect": "Gaming/Dialect/Dialect.pdf",
  "Cities Without Numbers": "Gaming/dtrpg-2023-08-23_02-53pm/CitiesWithoutNumber_Deluxe_081123.pdf",
  "1631270095": "Gaming/Eclipse Phase/EP2 - Player's Guide.pdf",
  "2370011850948": "Gaming/Eclipse_Phase_Multiplicity_and_Synthesis.pdf",
  "Eldritch Sands": "Gaming/Eldridtch Sands/Eldridtch Sands - 5E.pdf",
  "Follow": "Gaming/Follow_RPG.pdf",
  "Improv for Gamers": "Gaming/Improv for Gamers.pdf",
  "In This World": "Gaming/In_This_World.pdf",
  "Incantations": "Gaming/Incantations_v2.5.pdf",
  "Interface Zero": "Gaming/Interface Zero 2.0/Interface Zero 2.0 - Pathfinder.pdf",
  "Mausritter": "Gaming/Mausritter/mausritter-rules-2.3.pdf",
  "Mini Dungeon Tome": "Gaming/Mini Dungeon Tome (5E).pdf",
  "Navigator": "Gaming/Navigator.pdf",
  "ORUN": "Gaming/ORUN.pdf",
  "Overlight": "Gaming/Overlight - Core.pdf",
  "Remarkable Cults and Their Followers": "Gaming/Remarkable Cults and Their Followers.pdf",
  "Remarkable Shops And Their Wares": "Gaming/Remarkable Shops And Their Wares.pdf",
  "Remarkable Guilds And Their Heroes": "Gaming/Remarkable_Guilds___Their_Heroes_-_Loresmyth.pdf",
  "Spectacular Settlements": "Gaming/Spectacular Settlements.pdf",
  "The Survivalist's Guide to Spelunking": "Gaming/Survivalists-Guide-to-Spelunking-v1.pdf",
  "Uncaged Goddesses": "Gaming/Uncaged Goddesses/Uncaged Goddesses.pdf",
  "Unframed": "Gaming/Unframed/Unframed the Art of Improvisation.pdf",
  "Urban Shadows 2": "Gaming/UrbanShadows2-CoreBook-web20240229.pdf",
  "Vurt": "Gaming/VURT/Vurt the Tabletop Roleplaying Game hyperlinked .pdf"
};
const volumes = {
  "Fiasco Companion": "games/RPGs/ By-Publisher/Bully Pulpit Games/Fiasco Classic/Fiasco Companion.pdf",
  "Fiasco Anthology 1": "games/RPGs/ By-Publisher/Bully Pulpit Games/Fiasco Classic/Fiasco Playset Anthology Vol 1.pdf",
  "Fiasco Anthology 2": "games/RPGs/ By-Publisher/Bully Pulpit Games/Fiasco Classic/Fiasco Playset Anthology Vol 2.pdf",
  "Fiasco Anthology 3": "games/RPGs/ By-Publisher/Bully Pulpit Games/Fiasco Classic/Fiasco Playset Anthology Vol 3.pdf",
  "Fiasco": "games/RPGs/ By-Publisher/Bully Pulpit Games/Fiasco Classic/Fiasco.pdf",
  "Night Witches": "games/RPGs/ By-Publisher/Bully Pulpit Games/Night Witches.pdf",
  "The Skeletons": "games/RPGs/ By-Publisher/Bully Pulpit Games/The Skeletons/The Skeletons.pdf",
  "The Warren": "games/RPGs/ By-Publisher/Bully Pulpit Games/The Warren/The Warren.pdf",
  "Fate of Cthulhu": "games/RPGs/ By-Publisher/Evil Hat/FATE of Cthulhu/Fate of Cthulhu.pdf",
  "Aeon Wave": "games/RPGs/ By-Publisher/Evil Hat/FATE/Adventure Settings/Aeon Wave.pdf",
  "The Aether Sea": "games/RPGs/ By-Publisher/Evil Hat/FATE/Adventure Settings/Aether Sea.pdf",
  "DO Fate of the Flying Temple": "games/RPGs/ By-Publisher/Evil Hat/FATE/Adventure Settings/Do - Fate of the Flying Temple.pdf",
  "Fate Worlds 1": "games/RPGs/ By-Publisher/Evil Hat/FATE/Adventure Settings/Fate Worlds 1.pdf",
  "Fate Worlds 2": "games/RPGs/ By-Publisher/Evil Hat/FATE/Adventure Settings/Fate Worlds 2.pdf",
  "Gods and Monsters": "games/RPGs/ By-Publisher/Evil Hat/FATE/Adventure Settings/Gods and Monsters.pdf",
  "The Secret of Cats": "games/RPGs/ By-Publisher/Evil Hat/FATE/Adventure Settings/The Secrets of Cats.pdf",
  "Transhumanity's Fate": "games/RPGs/ By-Publisher/Evil Hat/FATE/Adventure Settings/Transhumanity's Fate.pdf",
  "Fate Accessibility Toolkit": "games/RPGs/ By-Publisher/Evil Hat/FATE/Fate Accessibility Toolkit.pdf",
  "Fate Adversary Toolkit": "games/RPGs/ By-Publisher/Evil Hat/FATE/Fate Adversary Toolkit.pdf",
  "Fate Core": "games/RPGs/ By-Publisher/Evil Hat/FATE/Fate Core.pdf",
  "Fate Horror Toolkit": "games/RPGs/ By-Publisher/Evil Hat/FATE/Fate Horror Toolkit.pdf",
  "Fate System Toolkit": "games/RPGs/ By-Publisher/Evil Hat/FATE/Fate System Toolkit PDF.pdf",
  "Bluebeard's Bride": "games/RPGs/ By-Publisher/Magpie Games/Bluebeard's Bride/Bluebeard's Bride.pdf",
  "Cartel": "games/RPGs/ By-Publisher/Magpie Games/Cartel/Cartel - Corebook.pdf",
  "Crossroads Carnival": "games/RPGs/ By-Publisher/Magpie Games/Crossroads Carnival/Crossroads Carnival.pdf",
  "Epyllion": "games/RPGs/ By-Publisher/Magpie Games/Epyllion/Epyllion - A Dragon Epic.pdf",
  "Masks": "games/RPGs/ By-Publisher/Magpie Games/Masks/Masks.pdf",
  "Pasion de las Pasion": "games/RPGs/ By-Publisher/Magpie Games/Pasion de las Pasion/Pasion.pdf",
  "Passing": "games/RPGs/ By-Publisher/Magpie Games/Passing/Passing.pdf",
  "Rapscallion": "games/RPGs/ By-Publisher/Magpie Games/Rapscallion/Rapscallion.pdf",
  "Root": "games/RPGs/ By-Publisher/Magpie Games/Root/RootTTPRG_Corebook_100721.pdf",
  "The Ward": "games/RPGs/ By-Publisher/Magpie Games/The Ward/The Ward.pdf",
  "Urban Shadows": "games/RPGs/ By-Publisher/Magpie Games/Urban Shadows/Urban Shadows - Core.pdf",
  "Return of the Lazy Dungeon Master": "games/RPGs/ By-Publisher/Sly Flourish/The Lazy DM/Return of the Lazy Dungeon Master.pdf",
  "The Lazy DM's Companion": "games/RPGs/ By-Publisher/Sly Flourish/The Lazy DM/The Lazy DM's Companion.pdf",
  "The Lazy Dungeon Master": "games/RPGs/ By-Publisher/Sly Flourish/The Lazy DM/The Lazy Dungeon Master.pdf",
  "Arium Create": "games/RPGs/Arium/Arium create v1.9.digital.pdf",
  "Arium Discover": "games/RPGs/Arium/Arium discover v1.3b digital.pdf",
  "Call of Catthulhu": "games/RPGs/Call Of Catthulhu/Call Of Catthulhu.pdf",
  "Coyote & Crow": "games/RPGs/Coyote & Crow/Coyote & Crow — Core Rulebook.pdf",
  "Technoir": "games/RPGs/DTRPG Downloads/Technoir.pdf",
  "2370009316678": "games/RPGs/Eclipse Phase/1E Materials/Adventures/Bump In the Night.pdf",
  "2370009316708": "games/RPGs/Eclipse Phase/1E Materials/Adventures/Continuity.pdf",
  "Ego Hunter": "games/RPGs/Eclipse Phase/1E Materials/Adventures/Ego Hunter.pdf",
  "2370007488407": "games/RPGs/Eclipse Phase/1E Materials/Adventures/Glory.pdf",
  "Million Year Echo": "games/RPGs/Eclipse Phase/1E Materials/Adventures/Million Year Echo.pdf",
  "2370005857502": "games/RPGs/Eclipse Phase/1E Materials/Adventures/The Devotees.pdf",
  "2370007752218": "games/RPGs/Eclipse Phase/1E Materials/Argonauts.pdf",
  "1631270060": "games/RPGs/Eclipse Phase/1E Materials/Eclipse Phase 1st Edition.pdf",
  "0984583580": "games/RPGs/Eclipse Phase/1E Materials/Firewall.pdf",
  "098458353X": "games/RPGs/Eclipse Phase/1E Materials/Gatecrashing.pdf",
  "0984583548": "games/RPGs/Eclipse Phase/1E Materials/Panopticon.pdf",
  "0984583556": "games/RPGs/Eclipse Phase/1E Materials/Rimward.pdf",
  "0984583521": "games/RPGs/Eclipse Phase/1E Materials/Sunward.pdf",
  "2370004208183": "games/RPGs/Eclipse Phase/1E Materials/The Stars Our Destination.pdf",
  "0984583564": "games/RPGs/Eclipse Phase/1E Materials/Transhuman.pdf",
  "163127001X": "games/RPGs/Eclipse Phase/1E Materials/X-Risks.pdf",
  "Zone Stalkers": "games/RPGs/Eclipse Phase/1E Materials/Zone Stalkers.pdf",
  "0984583505": "games/RPGs/Eclipse Phase/Eclipse Phase.pdf",
  "Blades In The Dark": "games/RPGs/Forged In The Dark/Blades In The Dark/BladesInTheDark - Corebook.pdf",
  "CBRPNK": "games/RPGs/Forged In The Dark/CBRPNK/CBRPNK-GM-mobile.pdf",
  "Hack The Planet": "games/RPGs/Forged In The Dark/Hack the Planet/HackThePlanet-Corebook-pages-20210208.pdf",
  "Scum And Villainy": "games/RPGs/Forged In The Dark/Scum And Villainy/BladesInTheDark-ScumAndVillainy-Corebook.pdf",
  "Grimoire": "games/RPGs/Grimoire/Grimoire-spreads.pdf",
  "Hard Wired Island": "games/RPGs/Hard Wired Island/Hard Wired Island.pdf",
  "Icarus": "games/RPGs/Icarus/Icarus.pdf",
  "Lancer": "games/RPGs/Lancer/Lancer - Core Book.pdf",
  "DO Book of Letters": "games/RPGs/Misc/Book of Letters.pdf",
  "DIE": "games/RPGs/Misc/DIE RPG.pdf",
  "Downfall": "games/RPGs/Misc/Downfall.pdf",
  "Kingdom": "games/RPGs/Misc/Kingdom.pdf",
  "Outlive Outdead": "games/RPGs/Misc/Outlive Outdead.pdf",
  "Paranoia": "games/RPGs/Misc/Paranoia/Paranoia.pdf",
  "DO Pilgrims of the Flying Temple": "games/RPGs/Misc/Pilgrims of the Flying Temple.pdf",
  "Sigmata": "games/RPGs/Misc/Sigmata.pdf",
  "Singularity": "games/RPGs/Misc/Singularity.pdf",
  "Spire - Blood and Dust": "games/RPGs/Misc/Spire — Blood and Dust.pdf",
  "Spire": "games/RPGs/Misc/Spire.pdf",
  "Tales From The Loop": "games/RPGs/Misc/Tales From The Loop/Tales from the Loop.pdf",
  "TinyDungeon": "games/RPGs/Misc/TinyDungeon 2E.pdf",
  "Mothership": "games/RPGs/Mothership/Mothership.pdf",
  "Apocalypse World": "games/RPGs/PbtA/Apocalypse World/Apocalypse World 2E.pdf",
  "City of Mist": "games/RPGs/PbtA/City of Mist/City of Mist.pdf",
  "Monster Hearts": "games/RPGs/PbtA/Monster Hearts/Monsterhearts 2.pdf",
  "Monster of the Week": "games/RPGs/PbtA/Monster of the Week/Monster of the Week.pdf",
  "Nahaul": "games/RPGs/PbtA/Nahual.pdf",
  "No Country for Old Kobolds": "games/RPGs/PbtA/No Country for Old Kobolds.pdf",
  "Nowhereville": "games/RPGs/PbtA/Nowhereville/Nowhereville.pdf",
  "Our Last Best Hope": "games/RPGs/PbtA/Our Last Best Hope/Our Last Best Hope.pdf",
  "The Sprawl": "games/RPGs/PbtA/Sprawl/The Sprawl.pdf",
  "The Veil": "games/RPGs/PbtA/The Veil/The Veil.pdf",
  "We Used to be Friends": "games/RPGs/PbtA/We Used to be Friends.pdf",
  "A Complicated Profession": "games/RPGs/Pew Pew/A Complicated Profession.pdf",
  "Bounty Hunters In Space": "games/RPGs/Pew Pew/Bounty Hunters In Space.pdf",
  "For a Few Credits More": "games/RPGs/Pew Pew/Pew Pew - For A Few Credits More.pdf",
  "Rules and Roberts": "games/RPGs/Rules and Roberts/Rules and Roberts - Cover.png",
  "Ryuutama": "games/RPGs/Ryuutama/Ryuutama — Cover.pdf",
  "Sigils In The Dark": "games/RPGs/Sigils In The Dark.pdf",
  "Alas for the Awful Sea": "games/RPGs/Storybrewers/Alas for the Awful Sea.pdf",
  "Good Society": "games/RPGs/Storybrewers/Good Society/Good Society.pdf",
  "Svalbard": "games/RPGs/Svalbard/Svalbard.pdf",
  "Venture and Dungeon": "games/RPGs/Venture and Dungeon.pdf",
  "You Are the Dungeon": "games/RPGs/You Are the Dungeon.pdf",
  "A Practical Guide to Designing for the Web": "media/eBooks/Business and Technical/Five Simple Steps/A Practical Guide to Designing for the Web/dftw_single.pdf",
  "A Practical Guide to Designing The Invisible": "media/eBooks/Business and Technical/Five Simple Steps/A Practical Guide to Designing The Invisible/DesigningTheInvisible-singles.pdf",
  "A Practical Guide to Designing with Data": "media/eBooks/Business and Technical/Five Simple Steps/A Practical Guide to Designing with Data/DWD_single.pdf",
  "A Practical Guide to Information Architecture": "media/eBooks/Business and Technical/Five Simple Steps/A Practical Guide to Information Architecture/IA_single.pdf",
  "A Practical Guide to Managing Web Projects": "media/eBooks/Business and Technical/Five Simple Steps/A Practical Guide to Managing Web Projects/ManagingWebProjects-singles.pdf",
  "A Practical Guide to Web App Success": "media/eBooks/Business and Technical/Five Simple Steps/A Practical Guide to Web App Success/FSS_WAS_single_151111.pdf",
  "APIs": "media/eBooks/Business and Technical/O'Reilly/APIs_A_Strategy_Guide.pdf",
  "The Bash Cookbook": "media/eBooks/Business and Technical/O'Reilly/bashcookbook.pdf",
  "Building Web Reputation Systems": "media/eBooks/Business and Technical/O'Reilly/Building_Web_Reputation_Systems.pdf",
  "Classic Shell Scripting": "media/eBooks/Business and Technical/O'Reilly/classicshellscripting.pdf",
  "CSS": "media/eBooks/Business and Technical/O'Reilly/css_thedefinitiveguide.pdf",
  "The CSS Cookbook": "media/eBooks/Business and Technical/O'Reilly/csscookbook.pdf",
  "CSS Refactoring": "media/eBooks/Business and Technical/O'Reilly/cssrefactoring.pdf",
  "Data Science At the Command Line": "media/eBooks/Business and Technical/O'Reilly/datascienceatthecommandline.pdf",
  "Designing Interfaces": "media/eBooks/Business and Technical/O'Reilly/Designing Interfaces Second Edition.pdf",
  "Designing Social Interfaces": "media/eBooks/Business and Technical/O'Reilly/Designing Social Interfaces.pdf",
  "The Docker Cookbook": "media/eBooks/Business and Technical/O'Reilly/dockercookbook.pdf",
  "Doing Data Science": "media/eBooks/Business and Technical/O'Reilly/doingdatascience.pdf",
  "Essential System Administration": "media/eBooks/Business and Technical/O'Reilly/essentialsystemadministration_3rdedition.pdf",
  "Information Architecture for the World Wide Web": "media/eBooks/Business and Technical/O'Reilly/Information_Architecture_for_the_World_Wide_Web_Third_Edition.pdf",
  "Javascript": "media/eBooks/Business and Technical/O'Reilly/JavaScript_The_Good_Parts.pdf",
  "Learning Web Design": "media/eBooks/Business and Technical/O'Reilly/Learning_Web_Design_Fourth_Edition.pdf",
  "The PHP Cookbook": "media/eBooks/Business and Technical/O'Reilly/phpcookbook.pdf",
  "The Regular Expressions Cookbook": "media/eBooks/Business and Technical/O'Reilly/regularexpressionscookbook.pdf",
  "The SQL Cookbook": "media/eBooks/Business and Technical/O'Reilly/sqlcookbook.pdf",
  "SVG Animations": "media/eBooks/Business and Technical/O'Reilly/svganimations.pdf",
  "Thoughtful Machine Learning With Python": "media/eBooks/Business and Technical/O'Reilly/thoughtfulmachinelearningwithpython.pdf",
  "UNIX In A Nutshell": "media/eBooks/Business and Technical/O'Reilly/unixinanutshell_4thedition.pdf",
  "UNIX Power Tools": "media/eBooks/Business and Technical/O'Reilly/unixpowertools.pdf",
  "The Windows Powershell Cookbook": "media/eBooks/Business and Technical/O'Reilly/windowspowershellcookbook.pdf",
  "Working With Statistics": "media/eBooks/Business and Technical/O'Reilly/workingwithstaticsites.pdf"
};

const comics = {
  "1563894459": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v01 - Back On the Street (2009) (Digital TPB) (Darkness-Empire).cbr",
  "1563894815": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v02 - Lust For Life (2009) (Digital TPB) (Darkness-Empire).cbr",
  "1563895684": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v03 - Year of the Bastard (2009) (Digital TPB) (Darkness-Empire).cbr",
  "1563896273": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v04 - The New Scum (2009) (Digital TPB) (Darkness-Empire).cbr",
  "1563897229": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v05 - Lonely City (2009) (Digital TPB) (Darkness-Empire).cbr",
  "1563897962": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v06 - Gouge Away (2010) (Digital TPB) (Darkness-Empire).cbr",
  "1563898942": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v07 - Spiders Thrash (2010) (Digital TPB) (Darkness-Empire).cbr",
  "1563899531": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v08 - Dirge (2010) (Digital TPB) (Madvillain-DCP).cbr",
  "1563899884": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v09 - The Cure (2011) (Digital TPB) (Madvillain-DCP).cbr",
  "1401202179": "comics/ By-Publisher/Vertigo/Transmetropolitan/TPBs/Transmetropolitan v10 - One More Time (2011) (Digital TPB) (Madvillain-DCP).cbr",
};

const games = {
  "1963197003": "games/RPGs/The Gauntlet/Brindlewood Bay/Brindlewood Bay (Kickstarter Edition).pdf",
  "1963197011": "games/RPGs/The Gauntlet/Brindlewood Bay/Nephews In Peril.pdf",
  'pba-publicaccess': 'games/RPGs/The Gauntlet/Public Access.pdf'
}

const volDir = jetpack.dir('/Volumes');
const dlDir = jetpack.dir('/Users/jeff/Library/Mobile Documents/com~apple~CloudDocs/Downloads');
const outdir = jetpack.dir('/Volumes/migration/input/books/rendered');

for (const [output, input] of Object.entries(games)) {
  const filename = toSlug(output) + '.jpg'
  if (!outdir.exists(filename)) {
    await getCoverArt(volDir.path(input), outdir.path(filename));
  }
}

// for (const [output, input] of Object.entries(downloads)) {
//   const filename = toSlug(output) + '.jpg'
//   if (!outdir.exists(filename)) {
//     await renderCoverArt(dlDir.path(input), outdir.path(filename));
//   }
// }

// for (const [output, input] of Object.entries(volumes)) {
//   const filename = toSlug(output) + '.jpg'
//   if (!outdir.exists(filename)) {
//     await renderCoverArt(volDir.path(input), outdir.path(filename));
//   }
// }