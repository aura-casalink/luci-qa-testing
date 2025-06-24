import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers.js';
import { TEST_CONFIG } from '../config/test-config.js';

let testHelpers;
let consoleLogs;
let consoleErrors;

test.beforeEach(async ({ page }) => {
  testHelpers = new TestHelpers();
  
  // Configurar recolección de logs
  const logCollector = await testHelpers.collectConsoleLogs(page);
  consoleLogs = logCollector.logs;
  consoleErrors = logCollector.errors;
});

test.describe('Callback QA Testing', () => {
  
  test('Callback completo - Realtime + UI + Supabase', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    let callbackId = null;
    
    try {
      // 1. Cargar página y esperar a que esté lista
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      
      // 2. Obtener información del dispositivo
      const viewport = page.viewportSize();
      const userAgent = await page.evaluate(() => navigator.userAgent);
      // 2.5. Iniciar conversación desde pantalla de bienvenida
      console.log('🎯 Iniciando conversación desde pantalla de bienvenida...');
      
      // Hacer click en "Buscar propiedades para comprar"
      await page.click('.option-button.primary');
      
      // Esperar a que aparezca la pantalla de chat
      await page.waitForSelector('.chat-screen', { timeout: 10000 });
      await page.waitForSelector('#chatInput', { timeout: 10000 });
      
      console.log('✅ Conversación iniciada correctamente');
      
      
      const deviceInfo = {
        ...testHelpers.getDeviceInfo(browserName, viewport),
        userAgent
      };
      
      console.log(`Testing en: ${browserName} - ${viewport.width}x${viewport.height}`);
      
      // 3. Simular conversación completa hasta confirmación
      console.log('💬 Simulando conversación hasta confirmación...');

      // Primer mensaje - responder a la pregunta inicial
      await page.fill('#chatInput', 'Quiero buscar un piso en Madrid de 2 habitaciones');
      await page.click('#sendButton');

      // Esperar respuesta de Luci
      await page.waitForSelector('.message.assistant:last-child', { timeout: 15000 });
      console.log('✅ Primera respuesta recibida');

      // Segundo mensaje - dar más detalles
      await testHelpers.sleep(2000);
      await page.fill('#chatInput', 'Máximo 300.000 euros, cerca del centro');
      await page.click('#sendButton');

      // Esperar respuesta de Luci
      await page.waitForSelector('.message.assistant:last-child', { timeout: 15000 });
      console.log('✅ Segunda respuesta recibida');

      // Tercer mensaje - confirmar búsqueda (esto debería activar Supabase)
      await testHelpers.sleep(2000);
      await page.fill('#chatInput', 'Sí, confirmo la búsqueda con esos criterios');
      await page.click('#sendButton');

      // Esperar que aparezca el estado de búsqueda
      await page.waitForSelector('#searchLoadingMessage', { timeout: 10000 });
      console.log('✅ Estado de búsqueda activado - Suscripción a Supabase iniciada');

      // Ahora activar modo test para insertar callback
      const testModeActivated = await page.evaluate((sessionId) => {
          window.currentSessionId = sessionId;
          window.pendingCallback = true;
          console.log('Modo test activado para session:', sessionId);
          return true;
      }, sessionId);
      
      // 4. Verificar que está en loading state
      await expect(page.locator('#searchLoadingMessage')).toBeVisible({ timeout: 5000 });
      console.log('✓ Loading state activado');
      
      // 5. Simular callback insertando en Supabase
      const callbackData = await testHelpers.insertCallbackToSupabase(sessionId);
      callbackId = callbackData.id;
      console.log(`✓ Callback insertado en Supabase con ID: ${callbackId}`);
      
      // 6. Esperar a que el callback aparezca en UI
      const uiResult = await testHelpers.waitForCallbackInUI(page, TEST_CONFIG.CALLBACK_TIMEOUT);
      console.log(`UI Result: ${uiResult.message}`);
      
      // 7. Verificar que el loading desapareció
      const loadingDisappeared = await testHelpers.waitForLoadingToDisappear(page, 10000);
      console.log(`✓ Loading desapareció: ${loadingDisappeared}`);
      
      // 8. Verificar que el callback fue marcado como procesado en Supabase
      const callbackProcessed = await testHelpers.checkCallbackProcessed(callbackId, 10000);
      console.log(`✓ Callback procesado en Supabase: ${callbackProcessed}`);
      
      // 9. Verificaciones detalladas del UI
      if (uiResult.success) {
        // Verificar que hay propiedades visibles
        expect(uiResult.propertyCount).toBeGreaterThan(0);
        
        // Verificar que las propiedades tienen el formato correcto
        const firstProperty = page.locator('.property-thumbnail').first();
        await expect(firstProperty).toBeVisible();
        
        // Verificar que las imágenes cargan
        const propertyImage = firstProperty.locator('img');
        await expect(propertyImage).toBeVisible();
        
        console.log(`✅ ÉXITO: ${uiResult.propertyCount} propiedades mostradas correctamente`);
      } else {
        // Si el UI falló, recopilar información de debugging
        const errorReport = {
          device: deviceInfo,
          sessionId,
          callbackId,
          uiResult,
          callbackProcessed,
          loadingDisappeared,
          consoleLogs: consoleLogs.slice(-20), // Últimos 20 logs
          consoleErrors,
          screenshot: await page.screenshot({ fullPage: true })
        };
        
        console.error('❌ FALLO EN UI:', JSON.stringify(errorReport, null, 2));
        
        // Guardar screenshot para debugging
        await page.screenshot({ 
          path: `test-results/failure-${browserName}-${viewport.width}x${viewport.height}-${Date.now()}.png`,
          fullPage: true 
        });
        
        throw new Error(`Callback no apareció en UI: ${uiResult.message}`);
      }
      
      // 10. Assertions finales
      expect(uiResult.success).toBe(true);
      expect(callbackProcessed).toBe(true);
      expect(loadingDisappeared).toBe(true);
      
    } catch (error) {
      // Generar reporte detallado de error
      const errorReport = testHelpers.generateErrorReport(
        { title: test.info().title, startTime: Date.now() },
        error,
        { logs: consoleLogs.slice(-30), errors: consoleErrors },
        testHelpers.getDeviceInfo(browserName, page.viewportSize())
      );
      
      console.error('REPORTE DE ERROR:', JSON.stringify(errorReport, null, 2));
      throw error;
      
    } finally {
      // Limpieza
      if (callbackId && sessionId) {
        await testHelpers.cleanupTestData(sessionId);
      }
    }
  });

  test('Test de timeout - Verificar polling fallback', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    
    try {
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      
      // Activar modo test pero NO insertar callback
      await testHelpers.activateTestMode(page, sessionId);
      
      // Verificar loading state
      await expect(page.locator('#searchLoadingMessage')).toBeVisible();
      
      // Esperar y verificar que el polling está funcionando
      // Buscar logs de polling en consola
      await page.waitForTimeout(15000); // Esperar 15 segundos
      
      const pollingLogs = consoleLogs.filter(log => 
        log.text.includes('Haciendo polling') || 
        log.text.includes('polling') ||
        log.text.includes('Activando polling')
      );
      
      expect(pollingLogs.length).toBeGreaterThan(0);
      console.log(`✅ Polling funcionando: ${pollingLogs.length} logs encontrados`);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });

  test('Test de múltiples callbacks rápidos', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    const callbackIds = [];
    
    try {
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      await testHelpers.activateTestMode(page, sessionId);
      
      // Insertar múltiples callbacks rápidamente
      for (let i = 0; i < 3; i++) {
        const callbackData = await testHelpers.insertCallbackToSupabase(
          sessionId, 
          { 
            ...TEST_CONFIG.SAMPLE_CALLBACK_DATA,
            session_id: sessionId,
            message: `Callback ${i + 1} de 3`
          }
        );
        callbackIds.push(callbackData.id);
        await testHelpers.sleep(100); // 100ms entre callbacks
      }
      
      // Verificar que solo se procesa uno (el último normalmente)
      const uiResult = await testHelpers.waitForCallbackInUI(page, 30000);
      expect(uiResult.success).toBe(true);
      
      // Verificar que al menos uno fue procesado
      let processedCount = 0;
      for (const id of callbackIds) {
        const processed = await testHelpers.checkCallbackProcessed(id, 5000);
        if (processed) processedCount++;
      }
      
      expect(processedCount).toBeGreaterThan(0);
      console.log(`✅ ${processedCount} de ${callbackIds.length} callbacks procesados`);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  // Capturar screenshot final en caso de fallo
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('screenshot', { body: screenshot, contentType: 'image/png' });
    
    // Adjuntar logs de consola
    await testInfo.attach('console-logs', { 
      body: JSON.stringify(consoleLogs, null, 2), 
      contentType: 'application/json' 
    });
    
    if (consoleErrors.length > 0) {
      await testInfo.attach('console-errors', { 
        body: JSON.stringify(consoleErrors, null, 2), 
        contentType: 'application/json' 
      });
    }
  }
});
