// "More animals than people": places where an animal outnumbers the humans.
// Used by the My travels window. Add or fix entries freely.
//
//   where:   a country code (NZ, AU...) or a region name inside one
//            ('GB:Scotland'), matched against the places in places.js
//   people:  population, in millions
//   animals: [name, how many in millions], biggest first
//
// Rough recent figures (national farm counts and FAO estimates, rounded).
// Worth double-checking any you want to brag about.
const ANIMALS_VS_PEOPLE = [
    { where: 'FK', name: 'Falkland Islands', people: 0.0037, animals: [['sheep', 0.48]] },
    { where: 'GB:Wales', name: 'Wales', people: 3.1, animals: [['sheep', 8.8]] },
    { where: 'MN', name: 'Mongolia', people: 3.5, animals: [['sheep', 25], ['goats', 24], ['horses', 4]] },
    { where: 'NZ', name: 'New Zealand', people: 5.3, animals: [['sheep', 24], ['cows', 10]] },
    { where: 'UY', name: 'Uruguay', people: 3.4, animals: [['cows', 11.8], ['sheep', 6]] },
    { where: 'AU', name: 'Australia', people: 27, animals: [['sheep', 78], ['kangaroos', 40], ['cows', 28]] },
    { where: 'PY', name: 'Paraguay', people: 6.1, animals: [['cows', 13.9]] },
    { where: 'DK', name: 'Denmark', people: 6, animals: [['pigs', 11.5]] },
    { where: 'FO', name: 'Faroe Islands', people: 0.055, animals: [['sheep', 0.07]] },
    { where: 'IE', name: 'Ireland', people: 5.3, animals: [['cows', 7]] },
    { where: 'GB:Scotland', name: 'Scotland', people: 5.5, animals: [['sheep', 6.6]] },
    { where: 'AR', name: 'Argentina', people: 46, animals: [['cows', 52]] },
    { where: 'BR', name: 'Brazil', people: 212, animals: [['cows', 238]] }
];
