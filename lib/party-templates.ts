/**
 * Templates de soirée prédéfinis
 * Chaque template pré-remplit les tâches, la liste de courses et les sondages
 */

export interface PartyTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  suggestedTasks: { title: string; priority: "low" | "medium" | "high" }[];
  suggestedShopping: { name: string; price: number }[];
  suggestedPolls: { question: string; options: string[] }[];
}

export const partyTemplates: PartyTemplate[] = [
  {
    id: "birthday",
    name: "Anniversaire",
    icon: "🎂",
    color: "#FF6B9D",
    description: "Fêtez un anniversaire mémorable avec gâteau, décorations et cadeaux",
    suggestedTasks: [
      { title: "Commander le gâteau", priority: "high" },
      { title: "Acheter les décorations", priority: "high" },
      { title: "Préparer la playlist", priority: "medium" },
      { title: "Installer les ballons et banderoles", priority: "medium" },
      { title: "Préparer le cadeau commun", priority: "high" },
      { title: "Organiser les jeux/activités", priority: "low" },
    ],
    suggestedShopping: [
      { name: "Gâteau d'anniversaire", price: 35 },
      { name: "Bougies", price: 5 },
      { name: "Ballons et banderoles", price: 15 },
      { name: "Assiettes et gobelets", price: 10 },
      { name: "Boissons (sodas, jus)", price: 20 },
      { name: "Chips et apéritifs", price: 15 },
      { name: "Serviettes et nappes", price: 8 },
    ],
    suggestedPolls: [
      { question: "Quel thème pour la déco ?", options: ["Tropical", "Noir & Or", "Années 80", "Pastel"] },
      { question: "Quel parfum pour le gâteau ?", options: ["Chocolat", "Fraisier", "Vanille", "Red Velvet"] },
    ],
  },
  {
    id: "bbq",
    name: "Barbecue",
    icon: "🔥",
    color: "#FF8C42",
    description: "Un BBQ convivial entre amis avec grillades et bonne ambiance",
    suggestedTasks: [
      { title: "Nettoyer le barbecue", priority: "high" },
      { title: "Acheter le charbon/gaz", priority: "high" },
      { title: "Préparer les marinades", priority: "medium" },
      { title: "Installer les tables et chaises", priority: "medium" },
      { title: "Préparer les salades", priority: "low" },
      { title: "Prévoir les jeux d'extérieur", priority: "low" },
    ],
    suggestedShopping: [
      { name: "Viande (merguez, brochettes, côtelettes)", price: 45 },
      { name: "Charbon de bois", price: 12 },
      { name: "Pain et sauces", price: 10 },
      { name: "Salades composées", price: 15 },
      { name: "Boissons fraîches", price: 25 },
      { name: "Fromage et charcuterie", price: 20 },
      { name: "Fruits pour le dessert", price: 12 },
    ],
    suggestedPolls: [
      { question: "Quel type de viande ?", options: ["Boeuf", "Poulet", "Merguez", "Végétarien"] },
      { question: "Qui ramène quoi ?", options: ["Entrées", "Viandes", "Desserts", "Boissons"] },
    ],
  },
  {
    id: "game_night",
    name: "Soirée Jeux",
    icon: "🎮",
    color: "#7C4DFF",
    description: "Jeux de société, jeux vidéo ou quiz pour une soirée fun",
    suggestedTasks: [
      { title: "Choisir les jeux de société", priority: "high" },
      { title: "Installer la console/TV", priority: "medium" },
      { title: "Préparer les équipes", priority: "medium" },
      { title: "Créer un quiz personnalisé", priority: "low" },
      { title: "Préparer les lots pour les gagnants", priority: "low" },
    ],
    suggestedShopping: [
      { name: "Snacks (chips, pop-corn)", price: 15 },
      { name: "Bonbons et chocolats", price: 10 },
      { name: "Pizza à commander", price: 40 },
      { name: "Boissons", price: 20 },
      { name: "Lots/petits cadeaux", price: 15 },
    ],
    suggestedPolls: [
      { question: "Quel type de jeux ?", options: ["Jeux de société", "Jeux vidéo", "Quiz/Trivial", "Jeux de cartes"] },
      { question: "Quelle pizza commander ?", options: ["Margherita", "4 Fromages", "Pepperoni", "Végétarienne"] },
    ],
  },
  {
    id: "movie_night",
    name: "Soirée Cinéma",
    icon: "🎬",
    color: "#1DE9B6",
    description: "Marathon de films ou projection spéciale entre amis",
    suggestedTasks: [
      { title: "Choisir les films", priority: "high" },
      { title: "Installer le vidéoprojecteur/TV", priority: "high" },
      { title: "Préparer les couvertures et coussins", priority: "medium" },
      { title: "Tamiser les lumières", priority: "low" },
    ],
    suggestedShopping: [
      { name: "Pop-corn (micro-ondes)", price: 8 },
      { name: "Bonbons et friandises", price: 12 },
      { name: "Sodas et jus", price: 15 },
      { name: "Nachos et guacamole", price: 10 },
      { name: "Glaces", price: 12 },
    ],
    suggestedPolls: [
      { question: "Quel genre de film ?", options: ["Action", "Comédie", "Horreur", "Science-Fiction"] },
      { question: "Combien de films ?", options: ["1 film", "2 films", "Marathon (3+)", "On verra !"] },
    ],
  },
  {
    id: "house_party",
    name: "House Party",
    icon: "🏠",
    color: "#FF4081",
    description: "Soirée à la maison avec musique, danse et bonne ambiance",
    suggestedTasks: [
      { title: "Préparer la playlist", priority: "high" },
      { title: "Installer la sono/enceintes", priority: "high" },
      { title: "Aménager l'espace danse", priority: "medium" },
      { title: "Installer les lumières d'ambiance", priority: "medium" },
      { title: "Ranger les objets fragiles", priority: "high" },
      { title: "Préparer un espace chill", priority: "low" },
    ],
    suggestedShopping: [
      { name: "Alcool (bières, vin, spiritueux)", price: 50 },
      { name: "Soft drinks et jus", price: 20 },
      { name: "Gobelets et verres jetables", price: 8 },
      { name: "Chips et snacks", price: 20 },
      { name: "Glaçons", price: 5 },
      { name: "Guirlandes LED", price: 15 },
    ],
    suggestedPolls: [
      { question: "Quel style de musique ?", options: ["Pop/Hits", "Électro/House", "Hip-Hop/Rap", "Mix de tout"] },
      { question: "Dress code ?", options: ["Casual", "Chic", "Thème couleur", "Déguisé"] },
    ],
  },
  {
    id: "picnic",
    name: "Pique-nique",
    icon: "🧺",
    color: "#66BB6A",
    description: "Sortie en plein air avec panier garni et bonne humeur",
    suggestedTasks: [
      { title: "Trouver le spot idéal", priority: "high" },
      { title: "Apporter les nappes et couverts", priority: "medium" },
      { title: "Préparer les sandwichs", priority: "high" },
      { title: "Apporter les jeux d'extérieur", priority: "low" },
      { title: "Vérifier la météo", priority: "medium" },
    ],
    suggestedShopping: [
      { name: "Pain et baguettes", price: 5 },
      { name: "Fromages variés", price: 15 },
      { name: "Charcuterie", price: 15 },
      { name: "Fruits frais", price: 10 },
      { name: "Tartes/quiches", price: 12 },
      { name: "Eau et limonade", price: 8 },
      { name: "Sacs poubelle", price: 3 },
    ],
    suggestedPolls: [
      { question: "Où pique-niquer ?", options: ["Parc", "Bord de rivière", "Forêt", "Plage"] },
      { question: "Salé ou sucré ?", options: ["Plutôt salé", "Plutôt sucré", "Les deux !", "Surprise"] },
    ],
  },
];
