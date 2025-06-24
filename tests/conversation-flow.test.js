import { test, expect } from '@playwright/test';

test('Test flujo conversacional completo', async ({ page }) => {
 // Configurar timeout de 8 minutos para todo el test
 test.setTimeout(480000);
 
 console.log('🚀 Iniciando test de flujo conversacional');
 
 // 1. Ir a la página
 await page.goto('https://luci-chatbot.vercel.app/');
 await page.waitForLoadState('networkidle');
 
 // 2. Iniciar conversación
 await page.click('.option-button.primary');
 await page.waitForSelector('.chat-screen', { timeout: 10000 });
 console.log('✅ Conversación iniciada');
 
 // 3. Primer mensaje
 await page.fill('#chatInput', 'Quiero buscar un piso en Madrid de 2 habitaciones');
 await page.click('#sendButton');
 await page.waitForSelector('.message.assistant:last-child', { timeout: 15000 });
 console.log('✅ Primera respuesta recibida');
 
 // 4. Segundo mensaje - más detalles
 await page.waitForTimeout(2000);
 await page.fill('#chatInput', 'Máximo 300.000 euros, cerca del centro');
 await page.click('#sendButton');
 await page.waitForSelector('.message.assistant:last-child', { timeout: 15000 });
 console.log('✅ Segunda respuesta recibida');
 
 // 5. Leer la última respuesta
 const lastMessage = await page.locator('.message.assistant:last-child').textContent();
 console.log('📝 Última respuesta de Luci:', lastMessage);
 
 // 6. Responder a la pregunta sobre características específicas
 await page.waitForTimeout(2000);
 await page.fill('#chatInput', 'No, con eso es suficiente');
 await page.click('#sendButton');
 await page.waitForSelector('.message.assistant:last-child', { timeout: 15000 });
 console.log('✅ Tercera respuesta recibida');
 
 // 7. Leer la respuesta de confirmación
 const confirmationMessage = await page.locator('.message.assistant:last-child').textContent();
 console.log('📝 Mensaje de confirmación:', confirmationMessage);
 
 // 8. Confirmar la búsqueda
 await page.waitForTimeout(2000);
 await page.fill('#chatInput', 'Sí, es correcto');
 await page.click('#sendButton');
 
 // 9. Esperar estado de búsqueda
 try {
   await page.waitForSelector('#searchLoadingMessage', { timeout: 15000 });
   console.log('✅ Estado de búsqueda detectado - Suscripción activa');
   
   // NUEVO: Simular callback con resultados
   console.log('📤 Simulando callback con propiedades...');
   
   // Esperar a que la suscripción se active completamente
   console.log('⏳ Esperando que la suscripción se active completamente...');
   await page.waitForTimeout(3000); // Dar tiempo a que se complete la activación

   // Esperar exactamente hasta que pendingCallback = true
   await page.waitForFunction(() => window.pendingCallback === true, { timeout: 30000 });

   // AHORA obtener sessionId
   const sessionId = await page.evaluate(() => {
     console.log('currentSessionId en window:', window.currentSessionId);
     console.log('pendingCallback:', window.pendingCallback);
     return window.currentSessionId;
   });

   if (!sessionId) {
     console.log('❌ FALLO: currentSessionId sigue siendo undefined después de activación');
     
     // Ver estado completo
     const debugState = await page.evaluate(() => ({
       currentSessionId: window.currentSessionId,
       pendingCallback: window.pendingCallback,
       currentTopic: window.currentTopic
     }));
     console.log('🔍 Estado debug:', debugState);
     return;
   }

   console.log('✅ Session ID obtenido correctamente:', sessionId);
   
   // Simular inserción de callback en Supabase
   const callbackData = {
     session_id: sessionId,
     message: "¡Perfecto! He encontrado algunas propiedades que coinciden con tus criterios:",
     properties: [
       {
         property_id: "test_prop_1",
         title: "Piso luminoso en Malasaña",
         thumbnail: "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/e9/3a/4c/1340892243.webp",
         price: 295000,
         floor: "3",
         size: 70,
         rooms: 2,
         bathrooms: 1,
         images: [
           "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/e9/3a/4c/1340892243.webp"
         ]
       },
       {
         property_id: "test_prop_2", 
         title: "Apartamento reformado en Chueca",
         thumbnail: "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/12/34/56/1340892244.webp",
         price: 285000,
         floor: "2",
         size: 65,
         rooms: 2,
         bathrooms: 1,
         images: [
           "https://img4.idealista.com/blur/WEB_DETAIL_TOP-XL-P/0/id.pro.es.image.master/12/34/56/1340892244.webp"
         ]
       }
     ]
   };
   
   // Insertar callback usando el endpoint real
   const response = await fetch(`https://luci-chatbot.vercel.app/api/callback?sessionId=${sessionId}`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
     },
     body: JSON.stringify(callbackData)
   });
   
   console.log('📤 Callback enviado, respuesta:', response.status);
   console.log('⏳ Esperando resultados... (puede tardar 3-4 minutos en tiempo real)');
   
   // Función para mostrar progreso mientras espera
   const showProgress = () => {
     let minutes = 0;
     const progressInterval = setInterval(() => {
       minutes++;
       console.log(`⏳ Esperando... ${minutes} minuto(s) transcurrido(s)`);
       if (minutes >= 5) {
         clearInterval(progressInterval);
       }
     }, 60000); // Cada minuto
     return progressInterval;
   };
   
   const progressInterval = showProgress();
   
   // Esperar a que aparezcan las propiedades en el UI (5 minutos)
   try {
     await page.waitForSelector('.properties-container', { timeout: 300000 });
     clearInterval(progressInterval);
     console.log('✅ ¡Propiedades aparecieron en el UI!');
     
     // Contar cuántas propiedades se muestran
     const propertyCount = await page.locator('.property-thumbnail').count();
     console.log(`🏠 Propiedades mostradas: ${propertyCount}`);
     
     // Verificar que el loading desapareció
     const loadingVisible = await page.locator('#searchLoadingMessage').isVisible();
     console.log(`🔄 Loading aún visible: ${loadingVisible}`);
     
     if (propertyCount > 0 && !loadingVisible) {
       console.log('🎉 ¡ÉXITO COMPLETO! El callback funcionó correctamente');
     } else {
       console.log('⚠️ Propiedades aparecieron pero algo no está bien');
     }
     
   } catch (error) {
     clearInterval(progressInterval);
     console.log('❌ FALLO: Las propiedades NO aparecieron en 5 minutos');
     console.log('🔍 Esto confirma el problema que describes');
     
     // Debug detallado
     const allElements = await page.locator('.message').count();
     console.log(`📊 Total mensajes en pantalla: ${allElements}`);
     
     const loadingStillVisible = await page.locator('#searchLoadingMessage').isVisible();
     console.log(`🔄 Loading aún visible: ${loadingStillVisible}`);
     
     // Verificar estado de conexión Realtime
     const realtimeStatus = await page.evaluate(() => {
       return {
         currentSessionId: window.currentSessionId,
         pendingCallback: window.pendingCallback,
         realtimeChannel: window.realtimeChannel ? 'activo' : 'inactivo'
       };
     });
     console.log('📊 Estado Realtime:', realtimeStatus);
     
     console.log('🔍 PROBLEMA CONFIRMADO: Callback enviado pero no se muestra en UI');
   }
   
 } catch (error) {
   console.log('⚠️ No se detectó estado de búsqueda');
   
   const allMessages = await page.locator('.message').count();
   console.log(`📊 Total de mensajes: ${allMessages}`);
   
   const lastResponse = await page.locator('.message.assistant:last-child').textContent();
   console.log('📝 Última respuesta:', lastResponse);
   
   // Intentar segunda confirmación
   await page.waitForTimeout(2000);
   await page.fill('#chatInput', 'Perfecto, búscame propiedades con esos criterios');
   await page.click('#sendButton');
   
   try {
     await page.waitForSelector('#searchLoadingMessage', { timeout: 15000 });
     console.log('✅ Estado de búsqueda detectado en segundo intento');
   } catch (error2) {
     console.log('⚠️ Tampoco detectó en segundo intento');
     const finalMessage = await page.locator('.message.assistant:last-child').textContent();
     console.log('📝 Mensaje final:', finalMessage);
   }
 }
 
 // 10. Esperar un poco más
 await page.waitForTimeout(5000);
 console.log('🏁 Test completado');
});
