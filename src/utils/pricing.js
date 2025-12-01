const BASE_PRICE_PER_PAGE = 100;

const levelFactors = {
  tecnico: 1.0,
  licenciatura: 1.0,
  mestrado: 1.3,
  doutoramento: 1.6,
};

const complexityFactors = {
  basica: 1.0,
  intermedia: 1.2,
  avancada: 1.4,
};

const urgencyFactors = {
  normal: 1.0,
  '72h': 1.3,
  '48h': 1.5,
  '24h': 1.8,
};

function calculatePrice({ pages, academicLevel, complexity, urgency }) {
  const levelFactor = levelFactors[academicLevel] || 1;
  const complexityFactor = complexityFactors[complexity] || 1;
  const urgencyFactor = urgencyFactors[urgency] || 1;
  const base = BASE_PRICE_PER_PAGE * pages;
  const total = base * levelFactor * complexityFactor * urgencyFactor;

  return {
    basePerPage: BASE_PRICE_PER_PAGE,
    levelFactor,
    complexityFactor,
    urgencyFactor,
    total,
  };
}

module.exports = { calculatePrice, BASE_PRICE_PER_PAGE, levelFactors, complexityFactors, urgencyFactors };
