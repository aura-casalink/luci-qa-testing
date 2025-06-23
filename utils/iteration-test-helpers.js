import { TestHelpers } from './test-helpers.js';
import { TEST_CONFIG } from '../config/test-config.js';

export class IterationTestHelpers extends TestHelpers {
  
  constructor() {
    super();
    this.conversationState = {
      currentIteration: 0,
      messagesExchanged: 0,
      lastCallbackReceived: null,
      iterationHistory: []
    };
  }

  // Simular flujo completo de conversación con múltiples iteraciones
  async simulateFullConversationFlow(page, sessionId, targetIteration = 3) {
    const results = {
      sessionId,
      targetIteration,
      completedIterations: 0,
      iterationResults: [],
      totalTime: 0,
      success: false,
      errors: []
    };

    const startTime = Date.now();

    try {
      console.log(`🎭 Iniciando simulación de conversación hasta iteración ${targetIteration}`);
      
      // Navegar por el flujo de conversación paso a paso
      const flow = TEST_CONFIG.CONVERSATION_FLOW;
      const steps = Object.entries(flow);
      
      for (const [stepName, stepConfig] of steps) {
        console.log(`📝 Ejecutando paso: ${stepName}`);
        
        const stepResult = await this.executeConversationStep(page, sessionId, stepName, stepConfig);
        results.iterationResults.push(stepResult);
        
        if (!stepResult.success) {
          results.errors.push(`Fallo en paso ${stepName}: ${stepResult.error}`);
          break;
        }
        
        // Si este paso dispara un callback (búsqueda), procesarlo
        if (stepConfig.triggersCallback) {
          const iteration = stepConfig.iteration;
          console.log(`🔄 Iteración ${iteration} - Esperando callback...`);
          
          const callbackResult = await this.processIterationCallback(page, sessionId, iteration);
          
          if (callbackResult.success) {
            results.completedIterations = iteration;
            console.log(`✅ Iteración ${iteration} completada exitosamente`);
          } else {
            results.errors.push(`Fallo en callback iteración ${iteration}: ${callbackResult.error}`);
            console.log(`❌ Iteración ${iteration} falló: ${callbackResult.error}`);
            break;
          }
          
          // Si hemos alcanzado la iteración objetivo, parar
          if (iteration >= targetIteration) {
            break;
          }
        }
        
        // Delay entre pasos para simular interacción humana real
        await this.sleep(TEST_CONFIG.ITERATION_TESTING.STEP_DELAY);
      }
      
      results.totalTime = Date.now() - startTime;
      results.success = results.completedIterations >= targetIteration;
      
      console.log(`🏁 Simulación completada: ${results.completedIterations}/${targetIteration} iteraciones`);
      
    } catch (error) {
      results.errors.push(`Error fatal en simulación: ${error.message}`);
      results.totalTime = Date.now() - startTime;
    }

    return results;
  }

  // Ejecutar un paso individual de la conversación
  async executeConversationStep(page, sessionId, stepName, stepConfig) {
    const result = {
      step: stepName,
      success: false,
      time: 0,
      error: null
    };

    const startTime = Date.now();

    try {
      // Escribir mensaje del usuario
      await page.fill('#chatInput', stepConfig.userMessage);
      await page.click('#sendButton');
      
      // Esperar respuesta del asistente
      await page.waitForSelector('.message.assistant:last-child', { 
        timeout: 15000 
      });
      
      // Verificar que la respuesta contiene elementos esperados
      const lastMessage = await page.locator('.message.assistant:last-child').textContent();
      const containsExpected = stepConfig.expectedResponse.toLowerCase();
      
      if (lastMessage.toLowerCase().includes(containsExpected)) {
        result.success = true;
      } else {
        result.error = `Respuesta no contiene "${containsExpected}". Respuesta: "${lastMessage}"`;
      }
      
    } catch (error) {
      result.error = `Error ejecutando paso: ${error.message}`;
    }

    result.time = Date.now() - startTime;
    return result;
  }

  // Procesar callback de una iteración específica
  async processIterationCallback(page, sessionId, iteration) {
    const result = {
      iteration,
      success: false,
      callbackReceived: false,
      uiUpdated: false,
      callbackProcessed: false,
      time: 0,
      error: null,
      callbackId: null
    };

    const startTime = Date.now();

    try {
      // 1. Verificar que entra en estado de búsqueda
      await this.waitForSearchingState(page);
      console.log(`🔍 Estado de búsqueda activado para iteración ${iteration}`);
      
      // 2. Insertar callback específico de la iteración
      const callbackData = {
        session_id: sessionId,
        iteration: iteration,
        ...TEST_CONFIG.ITERATION_CALLBACK_DATA[iteration]
      };
      
      const insertedCallback = await this.insertCallbackToSupabase(sessionId, callbackData);
      result.callbackId = insertedCallback.id;
      result.callbackReceived = true;
      
      console.log(`📤 Callback iteración ${iteration} insertado con ID: ${insertedCallback.id}`);
      
      // 3. Esperar que aparezca en UI (con timeout más largo para iteraciones)
      const uiResult = await this.waitForCallbackInUI(page, TEST_CONFIG.CALLBACK_TIMEOUT);
      result.uiUpdated = uiResult.success;
      
      if (!uiResult.success) {
        result.error = `UI no se actualizó: ${uiResult.message}`;
        return result;
      }
      
      console.log(`🎨 UI actualizado para iteración ${iteration}: ${uiResult.propertyCount} propiedades`);
      
      // 4. Verificar que el callback fue marcado como procesado
      const processed = await this.checkCallbackProcessed(insertedCallback.id, 10000);
      result.callbackProcessed = processed;
      
      if (!processed) {
        result.error = 'Callback no fue marcado como procesado en Supabase';
        return result;
      }
      
      // 5. Verificar propiedades específicas de la iteración
      const propertyVerification = await this.verifyIterationProperties(page, iteration);
      if (!propertyVerification.success) {
        result.error = `Propiedades incorrectas: ${propertyVerification.error}`;
        return result;
      }
      
      result.success = true;
      console.log(`✅ Iteración ${iteration} procesada completamente`);
      
    } catch (error) {
      result.error = `Error procesando iteración ${iteration}: ${error.message}`;
    }

    result.time = Date.now() - startTime;
    return result;
  }

  // Esperar a que la página entre en estado de búsqueda
  async waitForSearchingState(page, timeout = 10000) {
    try {
      // Esperar a que aparezca el loading de búsqueda
      await page.waitForSelector('#searchLoadingMessage', { timeout });
      
      // Verificar que el texto de búsqueda esté visible
      const searchText = await page.locator('#searchMessageText').textContent();
      console.log(`🔍 Estado de búsqueda detectado: "${searchText}"`);
      
      return true;
    } catch (error) {
      throw new Error(`No se detectó estado de búsqueda: ${error.message}`);
    }
  }

  // Verificar que las propiedades mostradas corresponden a la iteración
  async verifyIterationProperties(page, iteration) {
    const result = { success: false, error: null };
    
    try {
      const expectedProperties = TEST_CONFIG.ITERATION_CALLBACK_DATA[iteration].properties;
      const displayedProperties = await page.locator('.property-thumbnail').count();
      
      if (displayedProperties !== expectedProperties.length) {
        result.error = `Se esperaban ${expectedProperties.length} propiedades, se mostraron ${displayedProperties}`;
        return result;
      }
      
      // Verificar que las propiedades tienen los IDs correctos (si es posible)
      // Esto es una verificación básica - se puede expandir según el HTML generado
      result.success = true;
      
    } catch (error) {
      result.error = `Error verificando propiedades: ${error.message}`;
    }
    
    return result;
  }

  // Test específico para iteraciones críticas (2 y 3)
  async testCriticalIterations(page, sessionId) {
    const results = {
      sessionId,
      criticalIterationResults: {},
      overallSuccess: false,
      errors: []
    };

    for (const iteration of TEST_CONFIG.ITERATION_TESTING.CRITICAL_ITERATIONS) {
      console.log(`🎯 Testando iteración crítica: ${iteration}`);
      
      try {
        // Simular conversación hasta esta iteración
        const flowResult = await this.simulateFullConversationFlow(page, sessionId, iteration);
        
        results.criticalIterationResults[iteration] = {
          success: flowResult.success,
          time: flowResult.totalTime,
          completedIterations: flowResult.completedIterations,
          errors: flowResult.errors
        };
        
        if (!flowResult.success) {
          results.errors.push(`Iteración crítica ${iteration} falló`);
        }
        
      } catch (error) {
        results.criticalIterationResults[iteration] = {
          success: false,
          error: error.message
        };
        results.errors.push(`Error en iteración crítica ${iteration}: ${error.message}`);
      }
      
      // Limpiar estado entre iteraciones críticas
      await this.cleanupTestData(sessionId);
      await page.reload();
      await this.waitForPageReady(page);
    }

    // Evaluar éxito general
    const successfulIterations = Object.values(results.criticalIterationResults)
      .filter(r => r.success).length;
    
    results.overallSuccess = successfulIterations === TEST_CONFIG.ITERATION_TESTING.CRITICAL_ITERATIONS.length;
    
    return results;
  }

  // Generar reporte específico de iteraciones
  generateIterationReport(testResults, deviceInfo) {
    return {
      testType: 'iteration_testing',
      device: deviceInfo,
      timestamp: new Date().toISOString(),
      summary: {
        targetIterations: testResults.targetIteration || 'N/A',
        completedIterations: testResults.completedIterations || 0,
        success: testResults.success || false,
        totalTime: testResults.totalTime || 0
      },
      iterationResults: testResults.iterationResults || [],
      criticalIterations: testResults.criticalIterationResults || {},
      errors: testResults.errors || [],
      recommendations: this.generateRecommendations(testResults)
    };
  }

  // Generar recomendaciones basadas en los resultados
  generateRecommendations(testResults) {
    const recommendations = [];
    
    if (!testResults.success) {
      recommendations.push('🔴 CRÍTICO: Sistema de callbacks de iteración fallando');
    }
    
    if (testResults.errors && testResults.errors.length > 0) {
      recommendations.push('🔍 Revisar logs de errores específicos');
    }
    
    if (testResults.totalTime > 120000) { // Más de 2 minutos
      recommendations.push('⚠️ Rendimiento degradado en iteraciones');
    }
    
    const failedIterations = Object.entries(testResults.criticalIterationResults || {})
      .filter(([_, result]) => !result.success)
      .map(([iteration, _]) => iteration);
    
    if (failedIterations.length > 0) {
      recommendations.push(`🎯 Iteraciones problemáticas: ${failedIterations.join(', ')}`);
    }
    
    return recommendations;
  }
}
