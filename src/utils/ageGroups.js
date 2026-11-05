export const AGE_CATEGORIES = [
  { id: 'cat_1', min: 18, max: 30, label: '18 – 30 years', badge: '🌱 Young Adults (18-30)' },
  { id: 'cat_2', min: 31, max: 45, label: '31 – 45 years', badge: '💼 Prime Career (31-45)' },
  { id: 'cat_3', min: 46, max: 60, label: '46 – 60 years', badge: '✨ Mature Adults (46-60)' },
  { id: 'cat_4', min: 61, max: 75, label: '61 – 75 years', badge: '🌟 Golden Years (61-75)' },
  { id: 'cat_5', min: 76, max: 85, label: '76 – 85 years', badge: '💎 Silver Connections (76-85)' },
  { id: 'cat_6', min: 86, max: 100, label: '86 – 100 years', badge: '👑 Centurion (86-100)' },
];

// Helper function: Pass any numeric age (e.g. 26) -> Returns exact Category Object
export const getAgeCategory = (ageInput) => {
  const numericAge = parseInt(ageInput, 10);
  if (isNaN(numericAge)) return null;

  const category = AGE_CATEGORIES.find(
    (cat) => numericAge >= cat.min && numericAge <= cat.max
  );

  return category || null;
};