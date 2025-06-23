# 🚀 Setup del Sistema QA para Luci Chatbot

## 📁 Estructura de Proyecto Recomendada

**IMPORTANTE**: Crear un repositorio separado para QA testing.

```
luci-qa-testing/                    # ← NUEVO REPOSITORIO
├── README.md
├── SETUP.md                        # ← Este archivo
├── package.json
├── playwright.config.js
├── .github/
│   └── workflows/
│       └── qa-testing.yml
├── config/
│   └── test-config.js
├── utils/
│   ├── test-helpers.js
│   └── iteration-test-helpers.js
├── tests/
│   ├── callback-qa.test.js
│   ├── iteration-callback.test.js
│   ├── stress-test.test.js
│   └── monitoring.test.js
├── scripts/
│   └── run-qa.js
└── reports/                        # Se genera automáticamente
    ├── test-results/
    ├── playwright-report/
    └── qa-reports/
```

## 🏗️ Pasos de Instalación

### 1. Crear nuevo repositorio en GitHub

```bash
# En GitHub, crear nuevo repositorio llamado "luci-qa-testing"
# Clonar localmente
git clone https://github.com/[tu-usuario]/luci-qa-testing.git
cd luci-qa-testing
```

### 2. Crear estructura de archivos

```bash
# Crear carpetas
mkdir -p config utils tests scripts .github/workflows

# Copiar todos los archivos de los artifacts a sus ubicaciones correspondientes
# (ver estructura arriba)
```

### 3. Instalar dependencias

```bash
# Instalar dependencias de Node.js
npm install

# Instalar navegadores de Playwright  
npm run install-browsers

# Verificar instalación
npx playwright --version
```

### 4. Configurar variables de entorno (opcional)

Crear archivo `.env`:
```env
# Timeouts personalizados
CALLBACK_TIMEOUT=45000
PAGE_LOAD_TIMEOUT=15000

# URLs (ya configuradas en el código)
BASE_URL=https://lucy-chatbot.vercel.app
```

## 🧪 Primeras Pruebas

### Test Rápido de Verificación
```bash
# Test básico - debe completarse en 2-3 minutos
node scripts/run-qa.js quick

# Si todo funciona, verás:
# ✅ Tests pasados: 1
# ⏱️ Duración total: X minutos
```

### Test de Iteraciones (LO MÁS IMPORTANTE)
```bash
# Test específico para iteraciones 2-3 problemáticas
node scripts/run-qa.js iterations --headed

# Con navegador visible para debugging
node scripts/run-qa.js iterations --headed --debug
```

### Test en Safari (Problema Principal)
```bash
# Test específico en Safari móvil donde más fallan
node scripts/run-qa.js safari --report
```

## 📊 Interpretar Resultados

### ✅ Test Exitoso de Iteraciones
```
🎯 Testando flujo completo de 3 iteraciones en webkit
📊 REPORTE DE ITERACIONES:
✅ Iteraciones completadas: 3/3
⏱️ Tiempo total: 45.32s
🎯 Éxito general: SÍ
```

### ❌ Test Fallido (Lo que Detecta el Problema)
```
❌ Error en test de iteraciones: Callback no apareció en UI
💥 Iteración 2 falló: timeout
🚨 FALLO EN UI: Callback no apareció en UI: timeout después de 45000ms

Console Logs:
- "Activando polling como respaldo"
- "Haciendo polling para callbacks..."
- "Error en suscripción Realtime: WebSocket failed"
```

## 🔄 Automatización con GitHub Actions

### Configurar CI/CD

El workflow se ejecutará automáticamente:

- **Cada push a main**: Tests completos
- **Cada Pull Request**: Tests rápidos  
- **Cada hora**: Tests de monitorización
- **Manual**: Cualquier modo específico

### Configurar Alertas

En caso de fallos, el sistema:
1. Crea un **Issue automático** en GitHub
2. Incluye **screenshots** y **logs** detallados
3. Marca la **severidad** del problema

## 📈 Comandos de Uso Diario

### Para Desarrollo Diario
```bash
# Verificación rápida antes de deploy
node scripts/run-qa.js quick

# Test completo antes de release
node scripts/run-qa.js full --report
```

### Para Debugging de Problemas
```bash
# Test específico del problema de iteraciones
node scripts/run-qa.js iterations --headed --debug

# Test en Safari con todos los logs
node scripts/run-qa.js safari --headed --debug --report
```

### Para Monitorización
```bash
# Health check cada 30 minutos
node scripts/run-qa.js monitoring

# Análisis de degradación
node scripts/run-qa.js monitoring --report
```

## 🎯 Qué Buscar en los Reportes

### 🔴 Problemas Críticos
- **Iteración 2 o 3 fallan** → Problema principal detectado
- **Safari móvil con 0% éxito** → WebSocket no funciona
- **"polling como respaldo"** en logs → Realtime falló
- **pending=true en Supabase** → Callback no procesado

### 🟡 Problemas de Rendimiento  
- **Tiempo > 60s por iteración** → Sistema lento
- **Success rate < 80%** → Inestabilidad
- **Múltiples reintentos** → Conectividad problemática

### 🟢 Sistema Saludable
- **Success rate 100%** → Todo funciona
- **Tiempo < 30s por iteración** → Rendimiento óptimo
- **No logs de polling** → Realtime funciona correctamente

## 🚨 Troubleshooting

### Problema: "No se puede conectar a Supabase"
```bash
# Verificar conectividad
curl -I https://uxyxxhsgkprnuxohjhbc.supabase.co
```

### Problema: "Playwright browsers not found"
```bash
# Reinstalar navegadores
npx playwright install --with-deps
```

### Problema: "Tests timeout constantemente"
```bash
# Aumentar timeouts en config/test-config.js
CALLBACK_TIMEOUT: 60000  # Aumentar a 60s
```

## 📞 Próximos Pasos

1. **Setup inicial** → Ejecutar `node scripts/run-qa.js quick`
2. **Test de iteraciones** → `node scripts/run-qa.js iterations --headed`
3. **Configurar CI/CD** → Push del workflow a GitHub
4. **Monitorización diaria** → Revisar reportes automáticos
5. **Debugging activo** → Usar cuando detectes problemas

## 🎯 Objetivo Final

Este sistema te permitirá:
- ✅ **Detectar automáticamente** cuando las iteraciones 2-3 fallan
- ✅ **Identificar dispositivos específicos** con problemas (Safari móvil)
- ✅ **Recibir alertas inmediatas** cuando el sistema se degrada
- ✅ **Tener evidencia detallada** con screenshots y logs
- ✅ **Prevenir problemas** antes de que lleguen a usuarios

¡El sistema está listo para detectar y prevenir el problema de callbacks no mostrados! 🚀
