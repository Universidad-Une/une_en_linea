// Planes de estudio organizados por programa
const planesEstudio = {
  bachillerato: {
    nombre: "Bachillerato en línea",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Lengua y Comunicación I",
          "Pensamiento Matemático I",
          "Ciencias Sociales I",
          "La Materia y sus Interacciones",
          "Humanidades I",
          "Inglés I",
          "Laboratorio de Investigación",
          "Curriculum Ampliado (Educación para la Salud I)",
          "Cultura Digital I",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Lengua y Comunicación II",
          "Pensamiento Matemático II",
          "Ciencias Sociales II",
          "Cultura Digital II",
          "Conservación de la Energía y sus Interacciones con la Materia",
          "Humanidades II",
          "Inglés II",
          "Taller de Ciencias I",
          "Curriculum Ampliado (Educación para la Salud II)"
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Lengua y Comunicación III",
          "Pensamiento Matemático III",
          "Tecnologías de la Información y la Comunicación: Módulo I",
          "Ecosistemas, Interacciones Energía y Dinámica",
          "Humanidades III",
          "Inglés III",
          "Taller de Ciencias II",
          "Curriculum Ampliado (Educación para la Salud III)"
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Pensamiento Literario",
          "Temas Selectos de Matemáticas I",
          "Tecnologías de la Información y la Comunicación: Módulo II",
          "Ciencias Sociales III",
          "Reacciones Químicas Conservación de la Materia en la Formación de Nuevas Sustancias",
          "Taller de Cultura Digital",
          "Espacio y Sociedad",
          "Inglés IV",
          "Conciencia Histórica I Perspectivas del México Antiguo, los Contextos Globales",
          "Curriculum Ampliado (Educación para la Salud IV)"
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Ciencias de la Comunicación I",
          "Cálculo Diferencial",
          "Tecnologías de la Información y la Comunicación: Módulo III",
          "La Energía en los Procesos de la Vida Diaria",
          "Ciencias de la Salud I",
          "Administración I",
          "Conciencia Histórica II México Durante el Expansionismo Capitalista",
          "Curriculum Ampliado (Educación para la Salud V)"
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Ciencias de la Comunicación II",
          "Cálculo Integral",
          "Tecnologías de la Información y la Comunicación: Módulo IV",
          "Conciencia Histórica III La Realidad Actual en Perspectiva Histórica",
          "Temas Selectos de Matemáticas II",
          "Ciencias de la Salud II",
          "Administración II",
          "Organismos: Estructuras y Procesos, Herencia y Evolución Biológica",
          "Curriculum Ampliado (Educación para la Salud VI)"
        ],
      },
    ],
  },

  administracion: {
    nombre: "Administración",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje a distancia",
          "Fundamentos de contabilidad",
          "Fundamentos de mercadotecnia",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Redacción profesional",
          "Fundamentos de administración",
          "Sistemas de información en los negocios",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Comunicación en las organizaciones",
          "Matemáticas financieras",
          "Administración de recursos humanos",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Estadística para los negocios",
          "Derecho empresarial",
          "Fundamentos de economía",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Negociación",
          "Finanzas para los negocios",
          "Administración estratégica",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Contabilidad administrativa y de costos",
          "Operaciones en la empresa",
          "Desarrollo organizacional",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Plan de negocios",
          "Administración de pequeñas empresas",
          "Cadena de suministros",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Competitividad empresarial",
          "Simulación de negocios",
          "Gestión de la innovación",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Ética y valores en la empresa",
          "Administración de proyectos",
          "Teoría de la comunicación",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Gestión del capital humano",
          "Formulación y evaluación de proyectos de inversión",
          "Administración de riesgos en proyectos",
        ],
      },
    ],
  },

  licenciaturaEnAdministracion: {
    nombre: "Licenciatura en Administración",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje a distancia",
          "Fundamentos de contabilidad",
          "Fundamentos de mercadotecnia",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Redacción profesional",
          "Fundamentos de administración",
          "Sistemas de información en los negocios",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Comunicación en las organizaciones",
          "Matemáticas financieras",
          "Administración de recursos humanos",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Estadística para los negocios",
          "Derecho empresarial",
          "Fundamentos de economía",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Negociación",
          "Finanzas para los negocios",
          "Administración estratégica",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Contabilidad administrativa y de costos",
          "Operaciones en la empresa",
          "Desarrollo organizacional",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Plan de negocios",
          "Administración de pequeñas empresas",
          "Cadena de suministros",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Competitividad empresarial",
          "Simulación de negocios",
          "Gestión de la innovación",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Ética y valores en la empresa",
          "Administración de proyectos",
          "Teoría de la comunicación",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Gestión del capital humano",
          "Formulación y evaluación de proyectos de inversión",
          "Administración de riesgos en proyectos",
        ],
      },
    ],
  },

  licenciaturaEnAdministracionDeSistemasDeLaInformacion: {
    nombre: "Licenciatura en Administración de Sistemas de la Información",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategia de aprendizaje a distancia",
          "Fundamentos de contabilidad",
          "Fundamentos de mercadotecnia",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Redacción profesional",
          "Fundamentos de administración",
          "Sistemas de información en los negocios",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Comunicación en las organizaciones",
          "Matemáticas financieras",
          "Administración de los recursos humanos",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Estadísticas para los negocios",
          "Derecho empresarial",
          "Fundamentos de economía",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Negociación",
          "Bases de programación",
          "Administración estratégica",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Programación estructurada",
          "Telecomunicaciones",
          "Sistemas operativos",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Administración de bases de datos",
          "Redes de computadoras",
          "Negocios electrónicos",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Lenguaje orientado a objetos",
          "Seguridad y auditoría en informática",
          "Soluciones móviles",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Ética y valores en la empresa",
          "Administración de proyectos",
          "Consultorio en informática",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Formulación y evaluación de proyectos en inversión",
          "Administración de riesgos en proyectos",
          "Minería y almacenamiento de datos",
        ],
      },
    ],
  },

  licenciaturaEnContaduria: {
    nombre: "Licenciatura en Contaduría",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje a distancia",
          "Fundamentos de contabilidad",
          "Fundamentos de mercadotecnia",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Redacción profesional",
          "Fundamentos de administración",
          "Sistemas de información en los negocios",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Comunicación en las organizaciones",
          "Matemáticas financieras",
          "Administración de recursos",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Estadísticas para negocios",
          "Derecho empresarial",
          "Fundamentos de economía",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Negociación",
          "Finanzas para los negocios",
          "Contabilidad intermedia del balance",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Contabilidad intermedia de resultados",
          "Contabilidad administrativa",
          "Análisis e interpretación de estados financieros",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Plan de negocios",
          "Contabilidad de costos",
          "Bases fiscales",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Impuestos para personas físicas",
          "Contabilidad avanzada",
          "Sistema financiero mexicano",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Ética y valores en la empresa",
          "Impuestos para personas morales",
          "Sistemas de información para contabilidad",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Formulación y evaluación de proyectos de inversión",
          "Mercado de valores y dinero",
          "Auditoría",
        ],
      },
    ],
  },

  licenciaturaEnMercadotecnia: {
    nombre: "Licenciatura en Mercadotecnia",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje a distancia",
          "Fundamentos de contabilidad",
          "Fundamentos de mercadotecnia",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Redacción profesional",
          "Fundamentos de administración",
          "Sistemas de información en los negocios",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Comunicación en las organizaciones",
          "Matemáticas financieras",
          "Administración de recursos humanos",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Estadísticas para los negocios",
          "Derecho empresarial",
          "Fundamentos de economía",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Negociación",
          "Mezcla de mercadotecnia",
          "Administración estratégica",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Contabilidad administrativa y de costos",
          "Herramientas y estrategias de venta",
          "Segmentación de mercados",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Plan de negocios",
          "Psicología del consumidor",
          "Desarrollo emprendedor e innovación",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Neuro-mercadotecnia",
          "Estrategia de mercadotecnia",
          "Relaciones públicas",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Ética y valores en la empresa",
          "Teoría de la comunicación",
          "Dirección de mercadotecnia",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Promoción, publicidad e identidad de marca",
          "Negocios por internet",
          "Comunicación integral en mercadotecnia",
        ],
      },
    ],
  },

  licenciaturaEnComunicacion: {
    nombre: "Licenciatura en Comunicación",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje a distancia",
          "Fundamentos de la comunicación",
          "Estadística I",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Estadística II",
          "Habilidades socioemocionales",
          "Historia contemporánea",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Informática",
          "Habilidades profesionales",
          "Redacción y análisis literario",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Sociología de la comunicación",
          "Expresión creativa en la comunicación",
          "Mercadotecnia",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Liderazgo y trabajo colaborativo",
          "Métodos y herramientas de investigación",
          "Teorías de la comunicación",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Estrategias de negociación para la resolución de problemas",
          "Principios de la comunicación masiva",
          "Técnicas de la investigación en la comunicación",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Fotografía",
          "Introducción al diseño digital",
          "Periodismo digital",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Legislación de los medios",
          "Comunicación y desarrollo organizacional",
          "Taller de emprendimiento y comunicación aplicada",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Edición y aplicación del diseño digital",
          "Comunicación intercultural",
          "Apreciación cinematográfica",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Producción y desarrollo de contenidos multimedia",
          "Periodismo y opinión pública",
          "Guionismo",
        ],
      },
    ],
  },

  licenciaturaEnEducacion: {
    nombre: "Licenciatura en Educación",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje a distancia",
          "Filosofía y epistemología de la educación",
          "Historia de la educación",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Psicología de la educación",
          "Teorías de aprendizaje",
          "Psicología del desarrollo: Infancia",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Educación contemporánea",
          "Política educativa",
          "Psicología del desarrollo: adolescencia",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Estadística de educación",
          "Psicología del desarrollo: adulto y adulto mayor",
          "Didáctica",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Pedagogía",
          "Sociología",
          "Metodología de la investigación",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Evaluación del aprendizaje",
          "Diseño curricular",
          "Planeación educativa",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Investigación educativa",
          "Formación y evaluación docente",
          "Ética",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Orientación educativa",
          "Andragogía",
          "Tecnología aplicada a la educación",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Modelos del diseño instruccional",
          "Diseño de entornos virtuales de aprendizaje a distancia",
          "Inclusión educativa",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Administración en la educación",
          "Evaluación de programas educativos",
          "Seminario de educación",
        ],
      },
    ],
  },

  licenciaturaEnPsicologia: {
    nombre: "Licenciatura en Psicología",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje a distancia",
          "Metodología de la investigación",
          "Bases filosóficas y epistemológicas de la psicología",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Procesos psicológicos",
          "Estadística",
          "Psicología del desarrollo: de la concepción hasta la senectud",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Bases psicobiológicas del comportamiento",
          "Metodología cuantitativa y cualitativa",
          "Teorías y corrientes psicológicas",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Comunicación humana",
          "Teorías de la personalidad",
          "Teorías y técnicas de la entrevista",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Teorías y dinámicas de grupos",
          "Sexualidad humana",
          "Psicopatología de la infancia",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Psicopatología del adulto",
          "Psicometría de la infancia",
          "Psicometría de la adultez",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Psicodiagnóstico infantil",
          "Psicodiagnóstico del adulto",
          "Psicología social y comunitaria",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Principios teóricos de la psicología educativa",
          "Psicología de las organizaciones",
          "Intervenciones en crisis y emergencias psicológicas",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Evaluación e intervención en educación especial",
          "Evaluación y diagnóstico de las organizaciones",
          "Tanatología",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Psicología forense",
          "Orientación, asesoría y tutoría",
          "Evaluación e intervención psicoeducativa",
        ],
      },
    ],
  },

  licenciaturaEnComercioYNegociosGlobales: {
    nombre: "Licenciatura en Comercio y Negocios Globales",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje a distancia",
          "Mercado y competencia internacional",
          "Metodología de la investigación",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Matemáticas financieras",
          "Cotizaciones y mercado de divisas",
          "Microeconomía",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Estadísticas para los negocios",
          "Bases contables",
          "Macroeconomía",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Investigación de mercados",
          "Contabilidad de costos",
          "Derecho mercantil",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Comercialización internacional",
          "Contabilidad de finanzas",
          "Derecho laboral",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Geografía económica y política",
          "Transportación y canales de distribución internacional",
          "Derecho fiscal",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Política comercial internacional",
          "Finanzas empresariales",
          "Análisis y clasificación arancelaria",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Administración de la cadena",
          "Tratados comerciales internacionales",
          "Legislación aduanera aplicada",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Mercadotecnia global",
          "Estrategias de comercialización en redes sociales",
          "Legislación comercial internacional",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Seminario de comercio y negocios",
          "Dirección de plan de exportación",
          "Análisis de comercio",
        ],
      },
    ],
  },

  licenciaturaEnDisenoGrafico: {
    nombre: "Licenciatura en Diseño Gráfico",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estadística de aprendizaje a distancia",
          "Teorías del Diseño Gráfico",
          "Dibujo básico",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Diseño vectorial I",
          "Historia del arte",
          "Bases bidimensionales y tridimensionales",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Diseño vectorial II",
          "Teoría y psicología del color",
          "Comunicación visual",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Fotografía básica",
          "Diseño digital I",
          "Métodos del diseño",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Fotografía creativa y publicitaria",
          "Diseño digital II",
          "Diseño de logotipos",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: ["Diseño publicitario", "Diseño digital III", "Preprensa"],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Mercadotecnia digital",
          "Diseño editorial",
          "Audio visual I y audio digital",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: ["Audiovisual II", "Imagen corporativa", "Diseño web"],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Diseño de plataformas digitales",
          "Animación 2D",
          "Diseño de envase y empaque",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Metodología de la investigación",
          "Producción y arte digital",
          "Animación 3D",
        ],
      },
    ],
  },

  licenciaturaEnDerecho: {
    nombre: "Licenciatura en Derecho",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje",
          "Derecho romano",
          "Introducción al estudio del derecho",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Acto jurídico y personas",
          "Derecho constitucional",
          "Teoría general de las obligaciones",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Contratos civiles",
          "Argumentación jurídica",
          "Teoría general del proceso",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Derechos humanos y garantías",
          "Derecho procesal civil",
          "Derecho mercantil",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Teoría general del derecho penal y los delitos en México",
          "Títulos y operaciones de crédito",
          "Derecho administrativo",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Juicios orales en materia penal",
          "Contratos mercantiles",
          "Derecho familiar",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Derecho procesal mercantil",
          "Bienes y sucesiones",
          "Derecho individual de trabajo",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Derecho colectivo del trabajo",
          "Amparo I",
          "Medios alternativos a solución de controversias",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Amparo II",
          "Derecho internacional público",
          "Ética jurídica",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Filosofía del derecho",
          "Investigación y análisis jurídico",
          "Derecho internacional privado",
        ],
      },
    ],
  },

  ingenieriaIndustrial: {
    nombre: "Ingeniería Industrial",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Estrategias de aprendizaje a distancia",
          "Matemáticas en Ingeniería",
          "Introducción a la Ingeniería Industrial",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Administración I",
          "Administración II",
          "Cálculo Diferencial",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: ["Estudio del Trabajo I", "Contabilidad", "Estática"],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Teoría General de Sistemas",
          "Cálculo Integral",
          "Contabilidad de Costos",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Estudio del Trabajo II",
          "Administración Estratégica",
          "Dinámica",
        ],
      },
      {
        id: 6,
        title: "Bloque - 6",
        subjects: [
          "Probabilidad y Estadística I",
          "Procesos de Manufactura",
          "Ciencias de Materiales",
        ],
      },
      {
        id: 7,
        title: "Bloque - 7",
        subjects: [
          "Probabilidad y Estadística II",
          "Investigación de Operaciones I",
          "Termodinámica",
        ],
      },
      {
        id: 8,
        title: "Bloque - 8",
        subjects: [
          "Control de Calidad",
          "Automatización",
          "Investigación de Operaciones II",
        ],
      },
      {
        id: 9,
        title: "Bloque - 9",
        subjects: [
          "Planeación y Control de la Producción I",
          "Ergonomía y Seguridad Industrial",
          "Ingeniería Económica",
        ],
      },
      {
        id: 10,
        title: "Bloque - 10",
        subjects: [
          "Planeación y Control de la Producción II",
          "Ingeniería de Proyectos",
          "Seminario de Titulación",
        ],
      },
    ],
  },

  maestriaEnAdministracionDeNegocios: {
    nombre: "Maestría en Administración de Negocios",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Administración",
          "Contabilidad Administrativa",
          "Derecho Empresarial",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Administración del Capital Humano",
          "Métodos Cuantitativos",
          "Economía",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Habilidades Directivas y Gerenciales",
          "Finanzas Corporativas",
          "Administración de Cadena de Suministros",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Mercadotecnia Estratégica",
          "Calidad y Productividad",
          "Estadística Aplicada a los Negocios",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Desarrollo Organizacional",
          "Fundamentos de la Administración de Proyectos",
          "Administración en la Calidad y Riesgos en Proyectos",
        ],
      },
    ],
  },

  maestriaEnEducacion: {
    nombre: "Maestría en Educación",
    semestres: [
      {
        id: 1,
        title: "Bloque - 1",
        subjects: [
          "Filosofía de la Educación",
          "Metodología de la Investigación I",
          "Teorías del Aprendizaje",
        ],
      },
      {
        id: 2,
        title: "Bloque - 2",
        subjects: [
          "Historia de la Educación en México",
          "Metodología de la Investigación II",
          "Psicología de la Educación",
        ],
      },
      {
        id: 3,
        title: "Bloque - 3",
        subjects: [
          "Legislación Educativa",
          "Tecnología Educativa",
          "Modelos y Estrategias de Instrucción",
        ],
      },
      {
        id: 4,
        title: "Bloque - 4",
        subjects: [
          "Evaluación Educativa",
          "Planeación y Gestión de Instituciones Educativas",
          "Diseño Curricular",
        ],
      },
      {
        id: 5,
        title: "Bloque - 5",
        subjects: [
          "Educación por Competencias",
          "Educación Comparada",
          "Liderazgo y Dirección",
        ],
      },
    ],
  },
};

export function obtenerPlanEstudios(programa) {
  const plan = planesEstudio[programa];

  if (!plan) {
    console.warn(`No se encontró el plan de estudios para: ${programa}`);
    return [];
  }

  return plan;
}
