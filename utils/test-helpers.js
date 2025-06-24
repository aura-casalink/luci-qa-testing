import { createClient } from '@supabase/supabase-js';
import { TEST_CONFIG } from '../config/test-config.js';

export class TestHelpers {
  constructor() {
    this.supabase = createClient(TEST_CONFIG.SUPABASE_URL, TEST_CONFIG.SUPABASE_KEY);
  }

  // Generar session ID único para testing
  generateTestSessionId() {
    return `qa_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Esperar a que la página esté completamente cargada
  async waitForPageReady(page) {
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => window.supabase !== undefined);
    await page.waitForFunction(() => window.activateTestMode !== undefined);
  }

  // Activar modo test en la página
  async activateTestMode(page, sessionId) {
      // Primero hacer click en "Buscar propiedades para comprar" si estamos en pantalla de bienvenida
      const welcomeScreen = await page.locator('.welcome-screen').isVisible();
      if (welcomeScreen) {
          await page.click('.option-button.primary');
          await page.waitForSelector('.chat-screen', { timeout: 10000 });
          console.log('✅ Conversación iniciada desde pantalla de bienvenida');
      }
      
      return await page.evaluate((sessionId) => {
          return window.activateTestMode(sessionId);
      }, sessionId);
  }

  // Simular callback insertando directamente en Supabase
  async insertCallbackToSupabase(sessionId, callbackData = null) {
    const data = callbackData || {
      ...TEST_CONFIG.SAMPLE_CALLBACK_DATA,
      session_id: sessionId
    };

    const { data: insertedData, error } = await this.supabase
      .from('callbacks')
      .insert({
        session_id: sessionId,
        payload: data,
        pending: true,
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Error insertando callback: ${error.message}`);
    }

    return insertedData;
  }

  // Verificar si el callback fue procesado (pending = false)
  async checkCallbackProcessed(callbackId, timeoutMs = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const { data, error } = await this.supabase
        .from('callbacks')
        .select('pending')
        .eq('id', callbackId)
        .single();

      if (error) {
        throw new Error(`Error verificando callback: ${error.message}`);
      }

      if (!data.pending) {
        return true;
      }

      await this.sleep(1000); // Esperar 1 segundo
    }

    return false;
  }

  // Recoger logs de consola de la página
  async collectConsoleLogs(page) {
    const logs = [];
    const errors = [];

    page.on('console', msg => {
      logs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });

    page.on('pageerror', error => {
      errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    return { logs, errors };
  }

  // Verificar si el callback apareció en el UI
  async waitForCallbackInUI(page, timeoutMs = 30000) {
    try {
      // Esperar a que aparezcan las propiedades en el UI
      await page.waitForSelector('.properties-container', { timeout: timeoutMs });
      
      // Verificar que hay al menos una propiedad visible
      const propertyCount = await page.locator('.property-thumbnail').count();
      
      return {
        success: true,
        propertyCount,
        message: `Callback apareció en UI con ${propertyCount} propiedades`
      };
    } catch (error) {
      return {
        success: false,
        propertyCount: 0,
        message: `Callback no apareció en UI: ${error.message}`
      };
    }
  }

  // Verificar que el loading desapareció
  async waitForLoadingToDisappear(page, timeoutMs = 30000) {
    try {
      await page.waitForSelector('#searchLoadingMessage', { state: 'hidden', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  // Obtener información del dispositivo y navegador
  getDeviceInfo(browserName, viewport) {
    return {
      browser: browserName,
      viewport: viewport,
      userAgent: null, // Se llenará en el test
      isMobile: viewport.width <= 768,
      timestamp: new Date().toISOString()
    };
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Limpiar datos de test de Supabase
  async cleanupTestData(sessionId) {
    try {
      // Eliminar callbacks de test
      await this.supabase
        .from('callbacks')
        .delete()
        .eq('session_id', sessionId);

      // Eliminar chat sessions de test
      await this.supabase
        .from('chat_sessions')
        .delete()
        .eq('session_id', sessionId);

    } catch (error) {
      console.warn(`Warning: No se pudo limpiar datos de test: ${error.message}`);
    }
  }

  // Generar reporte de error
  generateErrorReport(testInfo, error, logs, deviceInfo) {
    return {
      testName: testInfo.title,
      device: deviceInfo,
      error: {
        message: error.message,
        stack: error.stack
      },
      consoleLogs: logs,
      timestamp: new Date().toISOString(),
      testDuration: Date.now() - testInfo.startTime
    };
  }
}
