import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers.js';
import { TEST_CONFIG } from '../config/test-config.js';

let testHelpers;

test.beforeEach(async () => {
  testHelpers = new TestHelpers();
});

test.describe('Stress Testing - Casos Extremos', () => {

  test('Conexión lenta - Simular red 3G', async ({ page, browserName }) => {
    // Simular conexión lenta
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 300 // 300ms latency
    });

    const sessionId = testHelpers.generateTestSessionId();
    
    try {
      await page.goto('/', { timeout: 60000 }); // Timeout mayor para red lenta
      await testHelpers.waitForPageReady(page);
      
      await testHelpers.activateTestMode(page, sessionId);
      
      // Insertar callback y verificar que funciona con red lenta
      const callbackData = await testHelpers.insertCallbackToSupabase(sessionId);
      const uiResult = await testHelpers.waitForCallbackInUI(page, 60000); // Mayor timeout
      
      expect(uiResult.success).toBe(true);
      console.log(`✅ Funciona correctamente con conexión lenta: ${browserName}`);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });

  test('Pérdida de conexión durante callback', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    
    try {
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      await testHelpers.activateTestMode(page, sessionId);
      
      // Simular pérdida de conexión
      const client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: true,
        downloadThroughput: 0,
        uploadThroughput: 0,
        latency: 0
      });
      
      await testHelpers.sleep(5000); // 5 segundos sin conexión
      
      // Restaurar conexión
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: -1,
        uploadThroughput: -1,
        latency: 0
      });
      
      // Insertar callback después de restaurar conexión
      const callbackData = await testHelpers.insertCallbackToSupabase(sessionId);
      
      // Verificar que el polling detecta el callback
      const uiResult = await testHelpers.waitForCallbackInUI(page, 45000);
      expect(uiResult.success).toBe(true);
      
      console.log(`✅ Recuperación después de pérdida de conexión: ${browserName}`);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });

  test('Callback con datos muy grandes', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    
    // Crear callback con muchas propiedades
    const largeCallbackData = {
      session_id: sessionId,
      message: "Aquí tienes una gran cantidad de propiedades:",
      properties: []
    };
    
    // Generar 50 propiedades de prueba
    for (let i = 0; i < 50; i++) {
      largeCallbackData.properties.push({
        property_id: `large_test_${i}`,
        title: `Propiedad de prueba número ${i + 1} con título muy largo que puede causar problemas de renderizado`,
        thumbnail: "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/e9/3a/4c/1340892243.webp",
        price: 200000 + (i * 10000),
        floor: String(Math.floor(i / 10) + 1),
        size: 50 + (i * 2),
        rooms: (i % 4) + 1,
        bathrooms: (i % 3) + 1,
        images: [
          "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/e9/3a/4c/1340892243.webp"
        ]
      });
    }
    
    try {
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      await testHelpers.activateTestMode(page, sessionId);
      
      const callbackData = await testHelpers.insertCallbackToSupabase(sessionId, largeCallbackData);
      const uiResult = await testHelpers.waitForCallbackInUI(page, 60000);
      
      expect(uiResult.success).toBe(true);
      
      // Verificar que se muestran las propiedades (máximo que puede mostrar el UI)
      const displayedProperties = await page.locator('.property-thumbnail').count();
      console.log(`✅ ${displayedProperties} propiedades mostradas de 50 enviadas: ${browserName}`);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });

  test('Múltiples pestañas simultáneas', async ({ browser, browserName }) => {
    const sessions = [];
    const contexts = [];
    
    try {
      // Crear 3 pestañas diferentes
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const sessionId = testHelpers.generateTestSessionId();
        
        contexts.push(context);
        sessions.push({ page, sessionId });
        
        await page.goto('/');
        await testHelpers.waitForPageReady(page);
        await testHelpers.activateTestMode(page, sessionId);
      }
      
      // Insertar callbacks para todas las sesiones casi simultáneamente
      const callbackPromises = sessions.map(async ({ page, sessionId }) => {
        const callbackData = await testHelpers.insertCallbackToSupabase(sessionId);
        const uiResult = await testHelpers.waitForCallbackInUI(page, 45000);
        return { sessionId, uiResult };
      });
      
      const results = await Promise.all(callbackPromises);
      
      // Verificar que todas las pestañas recibieron sus callbacks correctamente
      const successCount = results.filter(r => r.uiResult.success).length;
      expect(successCount).toBe(3);
      
      console.log(`✅ ${successCount}/3 pestañas funcionaron correctamente: ${browserName}`);
      
    } finally {
      // Limpiar todas las sesiones
      for (const { sessionId } of sessions) {
        await testHelpers.cleanupTestData(sessionId);
      }
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('Callback inmediatamente después de cargar página', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    
    try {
      await page.goto('/');
      
      // Insertar callback ANTES de que la página esté completamente lista
      const callbackPromise = testHelpers.insertCallbackToSupabase(sessionId);
      
      // Esperar a que la página esté lista
      await testHelpers.waitForPageReady(page);
      await testHelpers.activateTestMode(page, sessionId);
      
      // Esperar el resultado del callback
      await callbackPromise;
      
      const uiResult = await testHelpers.waitForCallbackInUI(page, 30000);
      expect(uiResult.success).toBe(true);
      
      console.log(`✅ Callback temprano procesado correctamente: ${browserName}`);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });

  test('Recargar página durante callback pendiente', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    
    try {
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      await testHelpers.activateTestMode(page, sessionId);
      
      // Insertar callback pero no esperar resultado
      await testHelpers.insertCallbackToSupabase(sessionId);
      
      await testHelpers.sleep(2000); // Esperar un poco
      
      // Recargar página
      await page.reload();
      await testHelpers.waitForPageReady(page);
      
      // Reactivar modo test con la misma sesión
      await testHelpers.activateTestMode(page, sessionId);
      
      // Verificar que el callback pendiente se procesa
      const uiResult = await testHelpers.waitForCallbackInUI(page, 30000);
      expect(uiResult.success).toBe(true);
      
      console.log(`✅ Callback procesado después de reload: ${browserName}`);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });
});

test.describe('Tests específicos por dispositivo', () => {

  test('Safari iOS - Gestión de memoria', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Test específico para Safari');
    
    const sessionId = testHelpers.generateTestSessionId();
    
    try {
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      
      // Simular que la app va a segundo plano (para Safari iOS)
      await page.evaluate(() => {
        // Simular evento de visibilidad
        Object.defineProperty(document, 'visibilityState', {
          writable: true,
          value: 'hidden'
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      await testHelpers.sleep(3000);
      
      // Volver a primer plano
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          writable: true,
          value: 'visible'
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      await testHelpers.activateTestMode(page, sessionId);
      
      const callbackData = await testHelpers.insertCallbackToSupabase(sessionId);
      const uiResult = await testHelpers.waitForCallbackInUI(page, 45000);
      
      expect(uiResult.success).toBe(true);
      console.log(`✅ Safari iOS maneja correctamente el segundo plano`);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });

  test('Android Chrome - Gestión de memoria baja', async ({ page, browserName }) => {
    test.skip(!page.viewportSize() || page.viewportSize().width > 768, 'Test específico para móvil');
    
    const sessionId = testHelpers.generateTestSessionId();
    
    try {
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      
      // Simular evento de memoria baja
      await page.evaluate(() => {
        if ('memory' in performance) {
          // Simular memoria baja
          const memoryEvent = new Event('lowmemory');
          window.dispatchEvent(memoryEvent);
        }
      });
      
      await testHelpers.activateTestMode(page, sessionId);
      
      const callbackData = await testHelpers.insertCallbackToSupabase(sessionId);
      const uiResult = await testHelpers.waitForCallbackInUI(page, 30000);
      
      expect(uiResult.success).toBe(true);
      console.log(`✅ Android Chrome maneja correctamente memoria baja`);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });
});
