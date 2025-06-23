import dotenv from 'dotenv';
dotenv.config();

export const TEST_CONFIG = {
  // URLs
  BASE_URL: 'https://lucy-chatbot.vercel.app',
  
  // Supabase config
  SUPABASE_URL: 'https://uxyxxhsgkprnuxohjhbc.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXh4aHNna3BybnV4b2hqaGJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NTM3ODEsImV4cCI6MjA1ODEyOTc4MX0.P_ggSy3oU2AvS55fQdwpnk3aFgznfVr6uCdqWH36IwY',
  
  // Webhook para simular callback
  CALLBACK_WEBHOOK: 'https://lucy-chatbot.vercel.app/api/callback',
  
  // Timeouts
  CALLBACK_TIMEOUT: 45000, // 45 segundos para callbacks de iteración
  PAGE_LOAD_TIMEOUT: 15000,
  ITERATION_DELAY: 3000, // Delay entre iteraciones
  
  // Flujo de conversación completo
  CONVERSATION_FLOW: {
    // Primera interacción - establecer búsqueda inicial
    INITIAL_SEARCH: {
      userMessage: 'Quiero buscar un piso en Madrid',
      expectedResponse: 'búsqueda',
      triggersCallback: false
    },
    
    // Segunda interacción - clarificar criterios
    CLARIFICATION: {
      userMessage: 'Busco 2 habitaciones, máximo 300.000 euros',
      expectedResponse: 'criterios',
      triggersCallback: false
    },
    
    // Tercera interacción - resumen y confirmación
    SUMMARY_CONFIRMATION: {
      userMessage: 'Sí, confirmo la búsqueda',
      expectedResponse: 'confirmo',
      triggersCallback: true, // PRIMERA BÚSQUEDA
      iteration: 1
    },
    
    // Cuarta interacción - feedback sobre resultados
    FEEDBACK: {
      userMessage: 'Me gustan pero quiero algo más céntrico',
      expectedResponse: 'céntrico',
      triggersCallback: false
    },
    
    // Quinta interacción - nueva confirmación después de feedback
    SECOND_CONFIRMATION: {
      userMessage: 'Perfecto, busca con estos nuevos criterios',
      expectedResponse: 'nuevos criterios',
      triggersCallback: true, // SEGUNDA BÚSQUEDA (CRÍTICA)
      iteration: 2
    },
    
    // Sexta interacción - segundo feedback
    SECOND_FEEDBACK: {
      userMessage: 'Ahora quiero también que tenga terraza',
      expectedResponse: 'terraza',
      triggersCallback: false
    },
    
    // Séptima interacción - tercera confirmación
    THIRD_CONFIRMATION: {
      userMessage: 'Sí, busca con terraza incluida',
      expectedResponse: 'terraza incluida',
      triggersCallback: true, // TERCERA BÚSQUEDA (MÁS CRÍTICA)
      iteration: 3
    }
  },
  
  // Datos de callback por iteración
  ITERATION_CALLBACK_DATA: {
    1: {
      message: "¡Perfecto! He encontrado algunas propiedades que coinciden con tus criterios iniciales:",
      properties: [
        {
          property_id: "iter1_prop1",
          title: "Piso en Chamberí",
          thumbnail: "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/e9/3a/4c/1340892243.webp",
          price: 280000,
          floor: "3",
          size: 70,
          rooms: 2,
          bathrooms: 1,
          images: ["https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/e9/3a/4c/1340892243.webp"]
        },
        {
          property_id: "iter1_prop2",
          title: "Apartamento en Malasaña",
          thumbnail: "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/12/34/56/1340892244.webp",
          price: 295000,
          floor: "2",
          size: 65,
          rooms: 2,
          bathrooms: 1,
          images: ["https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/12/34/56/1340892244.webp"]
        }
      ]
    },
    
    2: {
      message: "¡Excelente! He refinado la búsqueda para zonas más céntricas. Aquí tienes opciones mejoradas:",
      properties: [
        {
          property_id: "iter2_prop1",
          title: "Piso en Sol",
          thumbnail: "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/aa/bb/cc/1340892245.webp",
          price: 285000,
          floor: "4",
          size: 68,
          rooms: 2,
          bathrooms: 1,
          images: ["https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/aa/bb/cc/1340892245.webp"]
        },
        {
          property_id: "iter2_prop2",
          title: "Apartamento en Chueca",
          thumbnail: "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/dd/ee/ff/1340892246.webp",
          price: 299000,
          floor: "5",
          size: 72,
          rooms: 2,
          bathrooms: 1,
          images: ["https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/dd/ee/ff/1340892246.webp"]
        }
      ]
    },
    
    3: {
      message: "¡Fantástico! He encontrado propiedades céntricas con terraza que se ajustan perfectamente:",
      properties: [
        {
          property_id: "iter3_prop1",
          title: "Ático con terraza en Malasaña",
          thumbnail: "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/gg/hh/ii/1340892247.webp",
          price: 290000,
          floor: "6",
          size: 75,
          rooms: 2,
          bathrooms: 1,
          images: ["https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/gg/hh/ii/1340892247.webp"]
        }
      ]
    }
  },
  
  // Configuración de testing por iteración
  ITERATION_TESTING: {
    // Cuánto tiempo esperar entre cada paso del flujo
    STEP_DELAY: 2000,
    
    // Tiempo máximo para completar cada iteración
    ITERATION_TIMEOUT: 60000,
    
    // Número de iteraciones críticas a testear
    CRITICAL_ITERATIONS: [2, 3], // Segunda y tercera son las más problemáticas
    
    // Patrones para detectar estados de la conversación
    CONVERSATION_PATTERNS: {
      WAITING_FOR_CONFIRMATION: ['confirma', 'buscar', 'proceder'],
      WAITING_FOR_FEEDBACK: ['resultado', 'opción', 'interesa'],
      SEARCHING_STATE: ['buscando', 'encontrando', 'procesando'],
      RESULTS_SHOWN: ['properties-container', 'property-thumbnail']
    }
  }
};
