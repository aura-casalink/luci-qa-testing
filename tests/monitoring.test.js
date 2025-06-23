import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers.js';
import { TEST_CONFIG } from '../config/test-config.js';

let testHelpers;

test.beforeEach(async () => {
  testHelpers = new TestHelpers();
});

test.describe('Monitorización Continua - Health Checks', () => {

  test('Health check básico - Cada 5 minutos', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    const startTime = Date.now();
    
    try {
      // Test básico de funcionalidad
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      
      const loadTime = Date.now() - startTime;
      console.log(`⏱️ Tiempo de carga: ${loadTime}ms`);
      
      // Verificar que los elementos esenciales están presentes
      await expect(page.locator('.welcome-title')).toBeVisible();
      await expect(page.locator('.option-button.primary')).toBeVisible();
      
      // Test de callback básico
      await testHelpers.activateTestMode(page, sessionId);
      const callbackData = await testHelpers.insertCallbackToSupabase(sessionId);
      const uiResult = await testHelpers.waitForCallbackInUI(page, 30000);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Métricas de rendimiento
      const metrics = {
        browser: browserName,
        viewport: page.viewportSize(),
        loadTime,
        totalTime,
        callbackSuccess: uiResult.success,
        timestamp: new Date().toISOString()
      };
      
      console.log('📊 Métricas:', JSON.stringify(metrics, null, 2));
      
      // Assertions de rendimiento
      expect(loadTime).toBeLessThan(15000); // Máximo 15 segundos para cargar
      expect(totalTime).toBeLessThan(45000); // Máximo 45 segundos total
      expect(uiResult.success).toBe(true);
      
      // Guardar métricas para análisis posterior
      await test.info().attach('health-metrics', {
        body: JSON.stringify(metrics, null, 2),
        contentType: 'application/json'
      });
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });

  test('Test de degradación - Comparar con baseline', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    const measurements = [];
    
    try {
      // Realizar múltiples mediciones
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        
        await page.goto('/');
        await testHelpers.waitForPageReady(page);
        
        const loadTime = Date.now() - startTime;
        
        await testHelpers.activateTestMode(page, sessionId + `_${i}`);
        const callbackStart = Date.now();
        
        const callbackData = await testHelpers.insertCallbackToSupabase(sessionId + `_${i}`);
        const uiResult = await testHelpers.waitForCallbackInUI(page, 30000);
        
        const callbackTime = Date.now() - callbackStart;
        
        measurements.push({
          iteration: i + 1,
          loadTime,
          callbackTime,
          success: uiResult.success
        });
        
        await testHelpers.cleanupTestData(sessionId + `_${i}`);
        await testHelpers.sleep(2000); // Pausa entre mediciones
      }
      
      // Análisis de resultados
      const avgLoadTime = measurements.reduce((sum, m) => sum + m.loadTime, 0) / measurements.length;
      const avgCallbackTime = measurements.reduce((sum, m) => sum + m.callbackTime, 0) / measurements.length;
      const successRate = measurements.filter(m => m.success).length / measurements.length;
      
      const analysis = {
        browser: browserName,
        measurements,
        averages: {
          loadTime: avgLoadTime,
          callbackTime: avgCallbackTime,
          successRate
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('📈 Análisis de degradación:', JSON.stringify(analysis, null, 2));
      
      // Assertions de calidad
      expect(avgLoadTime).toBeLessThan(20000); // Promedio de carga
      expect(avgCallbackTime).toBeLessThan(30000); // Promedio de callback
      expect(successRate).toBe(1); // 100% de éxito
      
      // Detectar variaciones anómalas
      const loadTimeVariation = Math.max(...measurements.map(m => m.loadTime)) - Math.min(...measurements.map(m => m.loadTime));
      expect(loadTimeVariation).toBeLessThan(10000); // Máximo 10s de variación
      
    } finally {
      // Limpiar todas las sesiones de test
      for (let i = 0; i < 3; i++) {
        await testHelpers.cleanupTestData(sessionId + `_${i}`);
      }
    }
  });

  test('Monitor de errores críticos', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    const criticalErrors = [];
    
    // Capturar errores críticos
    page.on('pageerror', error => {
      if (error.message.includes('callback') || 
          error.message.includes('supabase') || 
          error.message.includes('realtime')) {
        criticalErrors.push({
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error' && 
          (msg.text().includes('callback') || 
           msg.text().includes('supabase') || 
           msg.text().includes('realtime'))) {
        criticalErrors.push({
          type: 'console.error',
          message: msg.text(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    try {
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      await testHelpers.activateTestMode(page, sessionId);
      
      // Esperar un tiempo para capturar errores
      await testHelpers.sleep(5000);
      
      const callbackData = await testHelpers.insertCallbackToSupabase(sessionId);
      const uiResult = await testHelpers.waitForCallbackInUI(page, 30000);
      
      // Esperar un poco más para capturar errores posteriores
      await testHelpers.sleep(5000);
      
      // Verificar que no hay errores críticos
      if (criticalErrors.length > 0) {
        console.error('🚨 ERRORES CRÍTICOS DETECTADOS:', criticalErrors);
        
        await test.info().attach('critical-errors', {
          body: JSON.stringify(criticalErrors, null, 2),
          contentType: 'application/json'
        });
      }
      
      expect(criticalErrors.length).toBe(0);
      expect(uiResult.success).toBe(true);
      
    } finally {
      await testHelpers.cleanupTestData(sessionId);
    }
  });

  test('Test de capacidad - Múltiples callbacks consecutivos', async ({ page, browserName }) => {
    const sessionId = testHelpers.generateTestSessionId();
    const results = [];
    
    try {
      await page.goto('/');
      await testHelpers.waitForPageReady(page);
      
      // Test de capacidad: 5 callbacks consecutivos
      for (let i = 0; i < 5; i++) {
        const testSessionId = `${sessionId}_capacity_${i}`;
        
        await testHelpers.activateTestMode(page, testSessionId);
        
        const startTime = Date.now();
        const callbackData = await testHelpers.insertCallbackToSupabase(testSessionId);
        const uiResult = await testHelpers.waitForCallbackInUI(page, 30000);
        const endTime = Date.now();
        
        results.push({
          iteration: i + 1,
          success: uiResult.success,
          time: endTime - startTime,
          propertyCount: uiResult.propertyCount
        });
        
        console.log(`Iteración ${i + 1}: ${uiResult.success ? '✅' : '❌'} (${endTime - startTime}ms)`);
        
        await testHelpers.cleanupTestData(testSessionId);
        await testHelpers.sleep(1000); // Pausa entre tests
      }
      
      // Análisis de capacidad
      const successCount = results.filter(r => r.success).length;
      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      const maxTime = Math.max(...results.map(r => r.time));
      
      const capacityReport = {
        browser: browserName,
        totalTests: results.length,
        successCount,
        successRate: successCount / results.length,
        avgTime,
        maxTime,
        results,
        timestamp: new Date().toISOString()
      };
      
      console.log('🏋️ Reporte de capacidad:', JSON.stringify(capacityReport, null, 2));
      
      // Assertions de capacidad
      expect(successCount).toBeGreaterThanOrEqual(4); // Al menos 80% de éxito
      expect(avgTime).toBeLessThan(35000); // Promedio menor a 35s
      expect(maxTime).toBeLessThan(60000); // Máximo menor a 60s
      
    } finally {
      // Limpiar todas las sesiones
      for (let i = 0; i < 5; i++) {
        await testHelpers.cleanupTestData(`${sessionId}_capacity_${i}`);
      }
    }
  });
});
