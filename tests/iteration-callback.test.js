import { test, expect } from '@playwright/test';
import { IterationTestHelpers } from '../utils/iteration-test-helpers.js';
import { TEST_CONFIG } from '../config/test-config.js';

let iterationHelpers;
let consoleLogs;
let consoleErrors;

test.beforeEach(async ({ page }) => {
  iterationHelpers = new IterationTestHelpers();
  
  // Configurar recolección de logs
  const logCollector = await iterationHelpers.collectConsoleLogs(page);
  consoleLogs = logCollector.logs;
  consoleErrors = logCollector.errors;
});

test.describe('🔄 Tests de Callbacks de Iteración', () => {
  
  test('Iteración completa 1-2-3 - Flujo crítico', async ({ page, browserName }) => {
    const sessionId = iterationHelpers.generateTestSessionId();
    
    try {
      console.log(`🎯 Testando flujo completo de 3 iteraciones en ${browserName}`);
      
      // 1. Cargar página y preparar
      await page.goto('/');
      await iterationHelpers.waitForPageReady(page);

      // Iniciar conversación desde pantalla de bienvenida
      await page.click('.option-button.primary');
      await page.waitForSelector('.chat-screen', { timeout: 10000 });
      
      // 2. Simular flujo completo hasta iteración 3
      const flowResult = await iterationHelpers.simulateFullConversationFlow(page, sessionId, 3);
      
      // 3. Generar reporte detallado
      const deviceInfo = {
        browser: browserName,
        viewport: page.viewportSize(),
        userAgent: await page.evaluate(() => navigator.userAgent)
      };
      
      const iterationReport = iterationHelpers.generateIterationReport(flowResult, deviceInfo);
      
      console.log('📊 REPORTE DE ITERACIONES:');
      console.log(`✅ Iteraciones completadas: ${flowResult.completedIterations}/3`);
      console.log(`⏱️ Tiempo total: ${(flowResult.totalTime / 1000).toFixed(2)}s`);
      console.log(`🎯 Éxito general: ${flowResult.success ? 'SÍ' : 'NO'}`);
      
      if (flowResult.errors.length > 0) {
        console.log('❌ Errores encontrados:');
        flowResult.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
      
      // 4. Adjuntar reporte detallado
      await test.info().attach('iteration-report', {
        body: JSON.stringify(iterationReport, null, 2),
        contentType: 'application/json'
      });
      
      // 5. Assertions críticas
      expect(flowResult.completedIterations).toBeGreaterThanOrEqual(2); // Al menos 2 iteraciones
      expect(flowResult.success).toBe(true);
      expect(flowResult.totalTime).toBeLessThan(180000); // Máximo 3 minutos
      
      // 6. Verificar que las iteraciones críticas funcionaron
      const criticalIterationsSuccessful = flowResult.iterationResults
        .filter(result => result.step.includes('CONFIRMATION'))
        .every(result => result.success);
      
      expect(criticalIterationsSuccessful).toBe(true);
      
    } catch (error) {
      console.error('💥 Error en test de iteraciones:', error.message);
      
      // Capturar screenshot de fallo
      await page.screenshot({ 
        path: `test-results/iteration-failure-${browserName}-${Date.now()}.png`,
        fullPage: true 
      });
      
      throw error;
      
    } finally {
      await iterationHelpers.cleanupTestData(sessionId);
    }
  });

  test('Test específico iteración 2 - La más problemática', async ({ page, browserName }) => {
    const sessionId = iterationHelpers.generateTestSessionId();
    
    try {
      console.log(`🎯 Testando específicamente iteración 2 en ${browserName}`);
      
      await page.goto('/');
      await iterationHelpers.waitForPageReady(page);
      
      // Simular conversación hasta iteración 2 solamente
      const flowResult = await iterationHelpers.simulateFullConversationFlow(page, sessionId, 2);
      
      // Verificaciones específicas para iteración 2
      expect(flowResult.completedIterations).toBe(2);
      expect(flowResult.success).toBe(true);
      
      // Verificar que la iteración 2 específicamente funcionó
      const iteration2Result = flowResult.iterationResults.find(r => 
        r.step === 'SECOND_CONFIRMATION'
      );
      expect(iteration2Result).toBeDefined();
      expect(iteration2Result.success).toBe(true);
      
      console.log(`✅ Iteración 2 completada en ${iteration2Result.time}ms`);
      
    } finally {
      await iterationHelpers.cleanupTestData(sessionId);
    }
  });

  test('Test específico iteración 3 - Casos extremos', async ({ page, browserName }) => {
    const sessionId = iterationHelpers.generateTestSessionId();
    
    try {
      console.log(`🎯 Testando específicamente iteración 3 en ${browserName}`);
      
      await page.goto('/');
      await iterationHelpers.waitForPageReady(page);
      
      // Simular conversación completa hasta iteración 3
      const flowResult = await iterationHelpers.simulateFullConversationFlow(page, sessionId, 3);
      
      // Verificaciones específicas para iteración 3
      expect(flowResult.completedIterations).toBe(3);
      expect(flowResult.success).toBe(true);
      
      // Verificar que todas las iteraciones se completaron
      const allConfirmations = flowResult.iterationResults.filter(r => 
        r.step.includes('CONFIRMATION')
      );
      expect(allConfirmations.length).toBe(3);
      expect(allConfirmations.every(r => r.success)).toBe(true);
      
      console.log(`✅ Las 3 iteraciones completadas exitosamente`);
      
    } finally {
      await iterationHelpers.cleanupTestData(sessionId);
    }
  });

  test('Test de fallo simulado en iteración 2', async ({ page, browserName }) => {
    const sessionId = iterationHelpers.generateTestSessionId();
    
    try {
      console.log(`🧪 Simulando fallo en iteración 2 para ${browserName}`);
      
      await page.goto('/');
      await iterationHelpers.waitForPageReady(page);
      
      // Simular conversación hasta justo antes de iteración 2
      const flow = TEST_CONFIG.CONVERSATION_FLOW;
      const steps = Object.entries(flow).slice(0, 4); // Hasta feedback
      
      for (const [stepName, stepConfig] of steps) {
        await iterationHelpers.executeConversationStep(page, sessionId, stepName, stepConfig);
        await iterationHelpers.sleep(1000);
      }
      
      // Simular el quinto paso que debería disparar iteración 2
      await page.fill('#chatInput', flow.SECOND_CONFIRMATION.userMessage);
      await page.click('#sendButton');
      
      // Esperar estado de búsqueda
      await iterationHelpers.waitForSearchingState(page);
      
      // NO INSERTAR CALLBACK - simular fallo
      console.log('⏸️ Simulando fallo: no se inserta callback de iteración 2');
      
      // Esperar y verificar que el sistema maneja el fallo correctamente
      const timeoutOccurred = await Promise.race([
        iterationHelpers.waitForCallbackInUI(page, 30000).then(() => false),
        iterationHelpers.sleep(30000).then(() => true)
      ]);
      
      // En este caso, esperamos que SÍ ocurra timeout (fallo simulado)
      expect(timeoutOccurred).toBe(true);
      
      // Verificar que el sistema de polling esté activo
      const pollingLogs = consoleLogs.filter(log => 
        log.text.includes('polling') || log.text.includes('Haciendo polling')
      );
      expect(pollingLogs.length).toBeGreaterThan(0);
      
      console.log(`✅ Sistema de polling activado correctamente: ${pollingLogs.length} logs`);
      console.log(`✅ Fallo simulado detectado y manejado apropiadamente`);
      
    } finally {
      await iterationHelpers.cleanupTestData(sessionId);
    }
  });

  test('Test de iteraciones con conexión inestable', async ({ page, browserName }) => {
    const sessionId = iterationHelpers.generateTestSessionId();
    
    try {
      console.log(`🌐 Testando iteraciones con conexión inestable en ${browserName}`);
      
      await page.goto('/');
      await iterationHelpers.waitForPageReady(page);
      
      // Simular conexión lenta durante iteraciones
      const client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 1 * 1024 * 1024 / 8, // 1 Mbps
        uploadThroughput: 500 * 1024 / 8, // 500 Kbps
        latency: 500 // 500ms latency
      });
      
      // Ejecutar flujo completo con conexión degradada
      const flowResult = await iterationHelpers.simulateFullConversationFlow(page, sessionId, 2);
      
      // Restaurar conexión normal
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: -1,
        uploadThroughput: -1,
        latency: 0
      });
      
      // Verificar que el sistema funciona incluso con conexión lenta
      expect(flowResult.completedIterations).toBeGreaterThanOrEqual(1);
      console.log(`✅ Sistema resiliente con conexión lenta: ${flowResult.completedIterations} iteraciones`);
      
    } finally {
      await iterationHelpers.cleanupTestData(sessionId);
    }
  });

  test('Test de múltiples iteraciones consecutivas rápidas', async ({ page, browserName }) => {
    const sessionId = iterationHelpers.generateTestSessionId();
    
    try {
      console.log(`⚡ Testando iteraciones consecutivas rápidas en ${browserName}`);
      
      await page.goto('/');
      await iterationHelpers.waitForPageReady(page);
      
      // Reducir delays para hacer iteraciones más rápidas
      const originalDelay = TEST_CONFIG.ITERATION_TESTING.STEP_DELAY;
      TEST_CONFIG.ITERATION_TESTING.STEP_DELAY = 500; // 500ms entre pasos
      
      try {
        const flowResult = await iterationHelpers.simulateFullConversationFlow(page, sessionId, 3);
        
        // Verificar que el sistema maneja iteraciones rápidas
        expect(flowResult.success).toBe(true);
        expect(flowResult.totalTime).toBeLessThan(120000); // Menos de 2 minutos
        
        console.log(`⚡ Iteraciones rápidas completadas en ${(flowResult.totalTime/1000).toFixed(2)}s`);
        
      } finally {
        // Restaurar delay original
        TEST_CONFIG.ITERATION_TESTING.STEP_DELAY = originalDelay;
      }
      
    } finally {
      await iterationHelpers.cleanupTestData(sessionId);
    }
  });

});

test.describe('🎯 Tests Específicos por Dispositivo - Iteraciones', () => {

  test('Safari iOS - Iteraciones críticas', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Test específico para Safari');
    
    const sessionId = iterationHelpers.generateTestSessionId();
    
    try {
      console.log('🍎 Testando iteraciones críticas en Safari iOS');
      
      await page.goto('/');
      await iterationHelpers.waitForPageReady(page);
      
      // Test específico de iteraciones críticas en Safari
      const criticalResult = await iterationHelpers.testCriticalIterations(page, sessionId);
      
      // Safari puede ser más lento, permitir al menos 1 iteración exitosa
      const successfulIterations = Object.values(criticalResult.criticalIterationResults)
        .filter(r => r.success).length;
      
      expect(successfulIterations).toBeGreaterThanOrEqual(1);
      
      console.log(`🍎 Safari iOS: ${successfulIterations} iteraciones críticas exitosas`);
      
      // Adjuntar reporte específico de Safari
      await test.info().attach('safari-critical-iterations', {
        body: JSON.stringify(criticalResult, null, 2),
        contentType: 'application/json'
      });
      
    } finally {
      await iterationHelpers.cleanupTestData(sessionId);
    }
  });

  test('Android Chrome - Iteraciones bajo presión de memoria', async ({ page, browserName }) => {
    test.skip(!page.viewportSize() || page.viewportSize().width > 768, 'Test específico para móvil');
    
    const sessionId = iterationHelpers.generateTestSessionId();
    
    try {
      console.log('🤖 Testando iteraciones en Android con presión de memoria');
      
      await page.goto('/');
      await iterationHelpers.waitForPageReady(page);
      
      // Simular presión de memoria
      await page.evaluate(() => {
        // Crear arrays grandes para simular presión de memoria
        window.memoryPressureTest = [];
        for (let i = 0; i < 1000; i++) {
          window.memoryPressureTest.push(new Array(1000).fill('memory-pressure'));
        }
      });
      
      const flowResult = await iterationHelpers.simulateFullConversationFlow(page, sessionId, 2);
      
      // Limpiar memoria de prueba
      await page.evaluate(() => {
        window.memoryPressureTest = null;
      });
      
      // Verificar que funciona bajo presión de memoria
      expect(flowResult.completedIterations).toBeGreaterThanOrEqual(1);
      
      console.log(`🤖 Android bajo presión: ${flowResult.completedIterations} iteraciones completadas`);
      
    } finally {
      await iterationHelpers.cleanupTestData(sessionId);
    }
  });

});

test.describe('📊 Monitorización de Iteraciones', () => {

  test('Health check de iteraciones - Cada 30 minutos', async ({ page, browserName }) => {
    const sessionId = iterationHelpers.generateTestSessionId();
    
    try {
      console.log(`💚 Health check de iteraciones en ${browserName}`);
      
      await page.goto('/');
      await iterationHelpers.waitForPageReady(page);
      
      const startTime = Date.now();
      
      // Test rápido de iteración 2 (la más crítica)
      const quickFlow = await iterationHelpers.simulateFullConversationFlow(page, sessionId, 2);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Métricas de health check
      const healthMetrics = {
        browser: browserName,
        viewport: page.viewportSize(),
        timestamp: new Date().toISOString(),
        duration,
        iterationsCompleted: quickFlow.completedIterations,
        success: quickFlow.success,
        errors: quickFlow.errors,
        averageIterationTime: duration / Math.max(quickFlow.completedIterations, 1)
      };
      
      console.log('💚 HEALTH CHECK METRICS:');
      console.log(`  ⏱️ Duration: ${(duration/1000).toFixed(2)}s`);
      console.log(`  🔄 Iterations: ${quickFlow.completedIterations}/2`);
      console.log(`  ✅ Success: ${quickFlow.success}`);
      console.log(`  📊 Avg per iteration: ${(healthMetrics.averageIterationTime/1000).toFixed(2)}s`);
      
      // Assertions de health check
      expect(duration).toBeLessThan(90000); // Máximo 90 segundos
      expect(quickFlow.completedIterations).toBeGreaterThanOrEqual(1);
      expect(quickFlow.success).toBe(true);
      
      // Adjuntar métricas
      await test.info().attach('health-check-metrics', {
        body: JSON.stringify(healthMetrics, null, 2),
        contentType: 'application/json'
      });
      
    } finally {
      await iterationHelpers.cleanupTestData(sessionId);
    }
  });

  test('Análisis de degradación de iteraciones', async ({ page, browserName }) => {
    const sessionId = iterationHelpers.generateTestSessionId();
    const measurements = [];
    
    try {
      console.log(`📈 Análisis de degradación en ${browserName}`);
      
      // Realizar 3 mediciones consecutivas
      for (let i = 0; i < 3; i++) {
        await page.goto('/');
        await iterationHelpers.waitForPageReady(page);
        
        const testSessionId = `${sessionId}_measurement_${i}`;
        const startTime = Date.now();
        
        const flowResult = await iterationHelpers.simulateFullConversationFlow(testSessionId, 2);
        
        const endTime = Date.now();
        
        measurements.push({
          measurement: i + 1,
          duration: endTime - startTime,
          iterationsCompleted: flowResult.completedIterations,
          success: flowResult.success,
          errors: flowResult.errors.length
        });
        
        await iterationHelpers.cleanupTestData(testSessionId);
        await iterationHelpers.sleep(2000); // Pausa entre mediciones
      }
      
      // Análisis de degradación
      const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length;
      const successRate = measurements.filter(m => m.success).length / measurements.length;
      const maxVariation = Math.max(...measurements.map(m => m.duration)) - 
                          Math.min(...measurements.map(m => m.duration));
      
      const degradationAnalysis = {
        browser: browserName,
        measurements,
        analysis: {
          avgDuration,
          successRate,
          maxVariation,
          isStable: maxVariation < 30000, // Variación menor a 30s
          performanceGrade: successRate >= 1 ? 'A' : successRate >= 0.8 ? 'B' : 'C'
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('📈 ANÁLISIS DE DEGRADACIÓN:');
      console.log(`  📊 Success Rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`  ⏱️ Avg Duration: ${(avgDuration/1000).toFixed(2)}s`);
      console.log(`  📏 Max Variation: ${(maxVariation/1000).toFixed(2)}s`);
      console.log(`  🎯 Performance Grade: ${degradationAnalysis.analysis.performanceGrade}`);
      
      // Assertions de degradación
      expect(successRate).toBeGreaterThanOrEqual(0.8); // Mínimo 80% éxito
      expect(avgDuration).toBeLessThan(120000); // Promedio menor a 2 minutos
      expect(maxVariation).toBeLessThan(60000); // Variación menor a 1 minuto
      
      // Adjuntar análisis
      await test.info().attach('degradation-analysis', {
        body: JSON.stringify(degradationAnalysis, null, 2),
        contentType: 'application/json'
      });
      
    } finally {
      // Limpiar todas las mediciones
      for (let i = 0; i < 3; i++) {
        await iterationHelpers.cleanupTestData(`${sessionId}_measurement_${i}`);
      }
    }
  });

});

test.afterEach(async ({ page }, testInfo) => {
  // Capturar información adicional en fallos
  if (testInfo.status !== testInfo.expectedStatus) {
    // Screenshot final
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('final-screenshot', { 
      body: screenshot, 
      contentType: 'image/png' 
    });
    
    // Estado de la conversación
    const conversationState = await page.evaluate(() => {
      return {
        currentSessionId: window.currentSessionId,
        pendingCallback: window.pendingCallback,
        currentConversation: window.currentConversation ? window.currentConversation.length : 0,
        messagesInDOM: document.querySelectorAll('.message').length
      };
    });
    
    await testInfo.attach('conversation-state', {
      body: JSON.stringify(conversationState, null, 2),
      contentType: 'application/json'
    });
    
    // Logs de consola específicos de iteraciones
    const iterationLogs = consoleLogs.filter(log => 
      log.text.includes('iteración') || 
      log.text.includes('iteration') || 
      log.text.includes('callback') ||
      log.text.includes('polling')
    );
    
    if (iterationLogs.length > 0) {
      await testInfo.attach('iteration-console-logs', {
        body: JSON.stringify(iterationLogs, null, 2),
        contentType: 'application/json'
      });
    }
    
    // Errores específicos
    if (consoleErrors.length > 0) {
      await testInfo.attach('console-errors', {
        body: JSON.stringify(consoleErrors, null, 2),
        contentType: 'application/json'
      });
    }
  }
});
