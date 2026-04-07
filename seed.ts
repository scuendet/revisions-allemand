import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbPath = process.env.DATABASE_PATH || './data/vocab.db'
const absolutePath = path.resolve(dbPath)

const dir = path.dirname(absolutePath)
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

const db = new Database(absolutePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS vocab (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit INTEGER NOT NULL,
    unit_title TEXT NOT NULL,
    french TEXT NOT NULL,
    german TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    vocab_id INTEGER NOT NULL REFERENCES vocab(id),
    mode TEXT NOT NULL CHECK(mode IN ('flashcard', 'audio', 'typing')),
    correct INTEGER NOT NULL CHECK(correct IN (0, 1)),
    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

interface VocabEntry {
  unit: number
  unit_title: string
  french: string
  german: string
}

const seedData: VocabEntry[] = [
  // Unit 1 – Mein Stundenplan
  { unit: 1, unit_title: 'Mein Stundenplan', french: "l'emploi du temps", german: 'der Stundenplan, die Stundenpläne' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "le jour d'école", german: 'der Schultag, die Schultage' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "l'élève (masculin)", german: 'der Schüler, die Schüler' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "l'élève (féminin)", german: 'die Schülerin, die Schülerinnen' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: 'la branche, la matière', german: 'das Schulfach, die Schulfächer' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: 'le français', german: '(das) Französisch' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "l'allemand", german: '(das) Deutsch' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "l'anglais", german: '(das) Englisch' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: 'la science, les sciences', german: '(die) Wissenschaft, die Wissenschaften' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "l'histoire", german: '(die) Geschichte' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: 'la géographie', german: '(die) Geografie' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "les arts plastiques (l'art visuel)", german: '(die) Kunst' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: 'les mathématiques', german: '(die) Mathematik' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: 'la musique', german: '(die) Musik' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "le sport (l'éducation physique)", german: '(der) Sport' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: 'Ma branche préférée est la biologie.', german: 'Mein Lieblingsfach ist Biologie.' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: 'en première heure (période) / En première période, j\'ai le sport.', german: 'in der ersten Stunde / In der ersten Stunde habe ich Sport.' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "en dernière heure (période) / En dernière heure, j'ai l'anglais.", german: 'in der letzten Stunde / In der letzten Stunde habe ich Englisch.' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: 'Le lundi, nous avons ... (+ branche)', german: 'Am Montag haben wir ... (+ Schulfach).' },
  { unit: 1, unit_title: 'Mein Stundenplan', french: "Après, nous avons l'histoire.", german: 'Dann haben wir Geschichte.' },

  // Unit 2 – Mein Lieblingsfach
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: 'Quelle est ta branche préférée ?', german: 'Was ist dein Lieblingsfach ?' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: "Ma branche préférée, c'est ___.", german: 'Mein Lieblingsfach ist ___.' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: 'aimer (bien)', german: 'mögen, er mag' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: "J'aime... / J'aime lire des livres.", german: 'Ich mag... / Ich mag Bücher lesen.' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: "Je n'aime pas... / Je n'aime pas l'histoire.", german: '... mag ich nicht. / Geschichte mag ich nicht.' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: 'ennuyeux, -euse', german: 'langweilig' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: 'intéressant, -e', german: 'interessant' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: 'compliqué, -e', german: 'kompliziert' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: 'difficile', german: 'schwer' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: 'super, génial', german: 'toll' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: 'Je trouve cela ennuyeux.', german: 'Das finde ich langweilig.' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: "J'aime les langues.", german: 'Ich liebe Sprachen.' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: "Je t'embrasse. / Amicalement. / Bien à vous (toi). / Cordialement.", german: 'Viele Grüsse' },
  { unit: 2, unit_title: 'Mein Lieblingsfach', french: 'à bientôt', german: 'Bis bald' },

  // Unit 3 – Meine Lehrer beschreiben
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'le maître, le professeur (masculin)', german: 'der Lehrer, die Lehrer' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'la maîtresse, le professeur (féminin)', german: 'die Lehrerin, die Lehrerinnen' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: "l'interview", german: 'das Interview, die Interviews' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'le hobby, le passe-temps', german: 'das Hobby, die Hobbys' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'le club de lecture', german: 'der Leseclub, die Leseclubs' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'le ski', german: 'das Skifahren' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'Quel est votre sport préféré ? (politesse)', german: 'Was ist Ihr Lieblingssport ?' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'Que faites-vous ? (politesse)', german: 'Was machen Sie ?' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'Avez-vous un instant ?', german: 'Haben Sie kurz Zeit ?' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'Merci beaucoup. / Sincères remerciements.', german: 'Herzlichen Dank.' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'jeune', german: 'jung' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'âgé, -e / vieux, vieille', german: 'alt' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'juste', german: 'fair' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'patient, -e', german: 'geduldig' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'intéressant, -e', german: 'interessant' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'amusant, -e', german: 'lustig' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'sévère', german: 'streng' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'sympathique', german: 'sympathisch' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'cool', german: 'cool' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'gentil, -le / aimable', german: 'nett' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'insolent, -e', german: 'frech' },
  { unit: 3, unit_title: 'Meine Lehrer beschreiben', french: 'grand, -e / petit, -e', german: 'gross / klein' },

  // Unit 4 – Mein Klassenzimmer beschreiben
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'la salle de classe', german: 'das Klassenzimmer, die Klassenzimmer' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'la pièce', german: 'das Zimmer, die Zimmer' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'Combien de ... ? / Combien de tables sont en classe ?', german: 'Wie viel/e ... ? / Wie viele Tische sind im Klassenzimmer ?' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'la chaise', german: 'der Stuhl, die Stühle' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'la fenêtre', german: 'das Fenster, die Fenster' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'le tableau noir', german: 'die Tafel, die Tafeln' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'le canapé', german: 'das Sofa, die Sofas' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: "l'étagère", german: 'das Regal, die Regale' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'la porte', german: 'die Tür, die Türen' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'la table', german: 'der Tisch, die Tische' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: "l'ordinateur", german: 'der Computer, die Computer' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'à gauche', german: 'links' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'à droite', german: 'rechts' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'devant', german: 'vorne' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'au fond', german: 'hinten' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'au mur', german: 'an der Wand' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'dans le coin', german: 'in der Ecke' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'au milieu', german: 'in der Mitte' },
  { unit: 4, unit_title: 'Mein Klassenzimmer beschreiben', french: 'À droite (contre le mur), il y a ...', german: 'Rechts (an der Wand) ist/sind ...' },

  // Unit 5 – Wir machen ein Projekt!
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'le projet', german: 'das Projekt, die Projekte' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'le groupe', german: 'die Gruppe, die Gruppen' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'le groupe ordinateur', german: 'die Computer-Gruppe, -n' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: "le groupe de musique (de l'école)", german: 'die Schülerband, -s' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'le groupe de cuisine', german: 'die Koch-Gruppe, -n' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'Qui participe ?', german: 'Wer macht mit ?' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'Qui fait quoi ?', german: 'Wer macht was ?' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'Qui a envie ?', german: 'Wer hat Lust ?' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: "C'est bête ! C'est stupide !", german: 'Das ist doof !' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'prendre des photos', german: 'fotografieren, er fotografiert' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'Viens donc... ! (impératif)', german: 'Komm doch ... !' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'savoir', german: 'wissen, er weiss' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'pas encore', german: 'noch nicht' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'Je ne sais pas encore.', german: 'Ich weiss noch nicht.' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'Oui, peut-être.', german: 'Ja, vielleicht.' },
  { unit: 5, unit_title: 'Wir machen ein Projekt!', french: 'ici', german: 'hier' },

  // Unit 6 – Mein Klassenzimmer ist im ersten Stock
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'la pièce, la chambre, la salle', german: 'das Zimmer, die Zimmer' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'la salle des maîtres, des profs', german: 'das Lehrerzimmer, die Lehrerzimmer' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'la salle de classe', german: 'das Klassenzimmer, die Klassenzimmer' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'la pièce, la salle', german: 'der Raum, die Räume' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: "la salle d'informatique", german: 'der Computerraum, die Computerräume' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: "la salle d'arts visuels", german: 'der Kunstraum, die Kunsträume' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'la bibliothèque', german: 'die Bibliothek, die Bibliotheken' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'la salle de sport, de gymnastique', german: 'die Turnhalle, die Turnhallen' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'les toilettes', german: 'die Toilette, die Toiletten' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'au rez-de-chaussée', german: 'im Erdgeschoss' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'au premier étage', german: 'im ersten Stock' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'deuxième, troisième, quatrième, ...', german: 'zweite, dritte, vierte, ...' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'à côté de', german: 'neben' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'à gauche de...', german: 'links neben ...' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'à droite de...', german: 'rechts neben...' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'à côté de la salle de sport', german: 'neben der Turnhalle' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'à côté de la bibliothèque', german: 'neben der Bibliothek' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'à côté de la salle des maîtres', german: 'neben dem Lehrerzimmer' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: 'à côté de la classe 8P3', german: 'neben der Klasse 8P3' },
  { unit: 6, unit_title: 'Mein Klassenzimmer ist im ersten Stock', french: '- Excusez-moi, où sont les toilettes ? - Les toilettes sont au 1er étage à gauche de la Bibliothèque. - Merci beaucoup !', german: '- Entschuldigung, wo sind die Toiletten ? - Die Toilette ist im ersten Stock links neben der Bibliothek. - Vielen Dank !' },

  // Unit 7 – Wie ist das Wetter?
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'Quel temps fait-il?', german: 'Wie ist das Wetter?' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'froid / chaud / Il fait froid. / Il fait chaud.', german: 'kalt / warm / Es ist kalt. / Es ist warm.' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: "J'ai froid / chaud. / Je n'ai pas froid / chaud.", german: 'Mir ist kalt / warm. / Mir ist nicht kalt / warm.' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'Il pleut.', german: 'Es regnet.' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'Le ciel est nuageux. Il y a des nuages.', german: 'Es ist bewölkt.' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'Il neige.', german: 'Es schneit.' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'Il y a du vent.', german: 'Es ist windig.' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'Le soleil brille.', german: 'Die Sonne scheint.' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'Il fait beau.', german: 'Es ist schön.' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'beau, belle', german: 'schön' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'Il fait 10 degrés.', german: 'Die Temperatur ist 10 Grad.' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'mouillé, mouillée', german: 'nass' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'mettre (un vêtement)', german: 'anziehen, er zieht … an' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'Que mets-tu? (vêtements)', german: 'Was ziehst du an?' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'la veste', german: 'die Jacke, die Jacken' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: "l'écharpe", german: 'der Schal, die Schals' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'le bonnet', german: 'die Mütze, die Mützen' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'le pull-over', german: 'der Pullover, die Pullover' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'le T-shirt', german: 'das T-Shirt, die T-Shirts' },
  { unit: 7, unit_title: 'Wie ist das Wetter?', french: 'le jeans', german: 'die Jeans, die Jeans' },

  // Unit 8 – Freizeitaktivitäten
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: "Qu'est-ce que tu aimes faire ?", german: 'Was machst du gern ?' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'jouer au hockey sur glace', german: 'Eishockey spielen' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'rencontrer des amis', german: 'Freunde treffen' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'lire des livres', german: 'Bücher lesen' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'surfer sur internet', german: 'im Internet surfen' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'aller au cinéma', german: 'ins Kino gehen' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'écouter de la musique', german: 'Musik hören' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'faire de la musique', german: 'Musik machen' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'rencontrer', german: 'treffen, er trifft' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'aimer (faire)', german: 'gern (machen)' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'préférer (faire)', german: 'lieber (machen)' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'aimer le plus (faire)', german: 'am liebsten (machen)' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: "l'activité de loisirs", german: 'die Freizeitaktivität, -en' },
  { unit: 8, unit_title: 'Freizeitaktivitäten', french: 'chaque jour, tous les jours', german: 'jeden Tag' },

  // Unit 9 – Was kannst du machen?
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'Que peux-tu faire ?', german: 'Was kannst du machen ?' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'Je peux bien ... (activité/verbe)', german: 'Ich kann gut ... (Aktivität/Verb)' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: "Qu'aimerais-tu faire ?", german: 'Was möchtest du machen ?' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'le cours', german: 'der Kurs, -e' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'on (pronom)', german: 'man' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'pouvoir', german: 'können : ich kann, du kannst, er kann' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'aimerait bien', german: 'möchten : ich möchte, du möchtest, er möchte' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'faire du judo', german: 'Judo machen' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: "faire de l'escalade", german: 'klettern' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: "faire la connaissance d'amis", german: 'Freunde kennenlernen' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'téléphoner', german: 'telefonieren' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'courir', german: 'laufen, er läuft' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'collectionner', german: 'sammeln' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: "s'amuser beaucoup", german: 'viel Spass haben' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: "les heures d'ouverture", german: 'die Öffnungszeiten' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'tous les jours', german: 'täglich' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'ouvert, ouverte', german: 'geöffnet' },
  { unit: 9, unit_title: 'Was kannst du machen?', french: 'fermé, fermée', german: 'geschlossen' },
]

interface VerbEntry {
  unit: number
  infinitive: string
  french: string
  ich: string
  du: string
  er: string
  wir: string
  ihr: string
  sie: string
}

const verbData: VerbEntry[] = [
  // Unit 2
  { unit: 2, infinitive: 'mögen', french: 'aimer (bien)', ich: 'mag', du: 'magst', er: 'mag', wir: 'mögen', ihr: 'mögt', sie: 'mögen' },
  // Basic verbs
  { unit: 0, infinitive: 'sein', french: 'être', ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid', sie: 'sind' },
  { unit: 0, infinitive: 'haben', french: 'avoir', ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt', sie: 'haben' },
  { unit: 0, infinitive: 'machen', french: 'faire', ich: 'mache', du: 'machst', er: 'macht', wir: 'machen', ihr: 'macht', sie: 'machen' },
  { unit: 0, infinitive: 'gehen', french: 'aller', ich: 'gehe', du: 'gehst', er: 'geht', wir: 'gehen', ihr: 'geht', sie: 'gehen' },
  { unit: 0, infinitive: 'spielen', french: 'jouer', ich: 'spiele', du: 'spielst', er: 'spielt', wir: 'spielen', ihr: 'spielt', sie: 'spielen' },
  { unit: 0, infinitive: 'hören', french: 'écouter', ich: 'höre', du: 'hörst', er: 'hört', wir: 'hören', ihr: 'hört', sie: 'hören' },
  { unit: 0, infinitive: 'lesen', french: 'lire', ich: 'lese', du: 'liest', er: 'liest', wir: 'lesen', ihr: 'lest', sie: 'lesen' },
  // Unit 5
  { unit: 5, infinitive: 'wissen', french: 'savoir', ich: 'weiss', du: 'weisst', er: 'weiss', wir: 'wissen', ihr: 'wisst', sie: 'wissen' },
  { unit: 5, infinitive: 'fotografieren', french: 'prendre des photos', ich: 'fotografiere', du: 'fotografierst', er: 'fotografiert', wir: 'fotografieren', ihr: 'fotografiert', sie: 'fotografieren' },
  // Unit 7
  { unit: 7, infinitive: 'anziehen', french: 'mettre (un vêtement)', ich: 'ziehe an', du: 'ziehst an', er: 'zieht an', wir: 'ziehen an', ihr: 'zieht an', sie: 'ziehen an' },
  // Unit 8
  { unit: 8, infinitive: 'treffen', french: 'rencontrer', ich: 'treffe', du: 'triffst', er: 'trifft', wir: 'treffen', ihr: 'trefft', sie: 'treffen' },
  { unit: 8, infinitive: 'laufen', french: 'courir', ich: 'laufe', du: 'läufst', er: 'läuft', wir: 'laufen', ihr: 'lauft', sie: 'laufen' },
  // Unit 9
  { unit: 9, infinitive: 'können', french: 'pouvoir', ich: 'kann', du: 'kannst', er: 'kann', wir: 'können', ihr: 'könnt', sie: 'können' },
  { unit: 9, infinitive: 'möchten', french: 'aimerait bien / vouloir', ich: 'möchte', du: 'möchtest', er: 'möchte', wir: 'möchten', ihr: 'möchtet', sie: 'möchten' },
  { unit: 9, infinitive: 'telefonieren', french: 'téléphoner', ich: 'telefoniere', du: 'telefonierst', er: 'telefoniert', wir: 'telefonieren', ihr: 'telefoniert', sie: 'telefonieren' },
  { unit: 9, infinitive: 'sammeln', french: 'collectionner', ich: 'sammle', du: 'sammelst', er: 'sammelt', wir: 'sammeln', ihr: 'sammelt', sie: 'sammeln' },
  { unit: 9, infinitive: 'klettern', french: "faire de l'escalade", ich: 'klettere', du: 'kletterst', er: 'klettert', wir: 'klettern', ihr: 'klettert', sie: 'klettern' },
]

// Group by unit
const unitGroups = new Map<number, VocabEntry[]>()
for (const entry of seedData) {
  if (!unitGroups.has(entry.unit)) {
    unitGroups.set(entry.unit, [])
  }
  unitGroups.get(entry.unit)!.push(entry)
}

const insert = db.prepare('INSERT INTO vocab (unit, unit_title, french, german) VALUES (?, ?, ?, ?)')
const checkUnit = db.prepare('SELECT COUNT(*) as count FROM vocab WHERE unit = ?')

let totalInserted = 0

for (const [unit, entries] of unitGroups) {
  const { count } = checkUnit.get(unit) as { count: number }
  if (count > 0) {
    console.log(`Unit ${unit}: already seeded (${count} entries), skipping.`)
    continue
  }
  const insertMany = db.transaction(() => {
    for (const entry of entries) {
      insert.run(entry.unit, entry.unit_title, entry.french, entry.german)
      totalInserted++
    }
  })
  insertMany()
  console.log(`Unit ${unit} (${entries[0].unit_title}): inserted ${entries.length} entries.`)
}

// Seed verbs
const checkVerbs = db.prepare('SELECT COUNT(*) as count FROM verbs')
const { count: verbCount } = checkVerbs.get() as { count: number }
if (verbCount > 0) {
  console.log(`Verbs: already seeded (${verbCount} entries), skipping.`)
} else {
  const insertVerb = db.prepare('INSERT INTO verbs (unit, infinitive, french, ich, du, er, wir, ihr, sie) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertVerbs = db.transaction(() => {
    for (const v of verbData) {
      insertVerb.run(v.unit, v.infinitive, v.french, v.ich, v.du, v.er, v.wir, v.ihr, v.sie)
    }
  })
  insertVerbs()
  console.log(`Verbs: inserted ${verbData.length} entries.`)
  totalInserted += verbData.length
}

if (totalInserted === 0) {
  console.log('Nothing new to seed.')
} else {
  console.log(`Done. Total inserted: ${totalInserted}`)
}

db.close()
