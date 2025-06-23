#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const QA_MODES = {
  'quick': {
    description: 'Test rápido en Chrome Desktop',
    projects: ['Desktop Chrome'],
    tests: ['tests/callback-qa.test.js']
  },
  'iterations': {
    description: 'Test específico de iteraciones críticas (2-3)',
    projects: ['Desktop Chrome', 'Mobile Safari iPhone', 'Mobile Chrome Android'],
    tests: ['tests/iteration-callback.test.js']
  },
  'full': {
    description: 'Test completo en todos los dispositivos',
    projects: null, // Todos los proyectos
    tests: ['tests/callback-qa.test.js', 'tests/stress-test.test.js', 'tests/iteration-callback.test.js']
  },
  'monitoring': {
    description: 'Tests de monitorización continua + iteraciones',
    projects: ['Desktop Chrome', 'Mobile Safari iPhone', 'Mobile Chrome Android'],
    tests: ['tests/monitoring.test.js', 'tests/iteration-callback.test.js']
  },
  'stress': {
    description: 'Tests de stress y casos extremos',
    projects: ['Desktop Chrome', 'Desktop Safari', 'Mobile Safari iPhone'],
    tests: ['tests/stress-test.test.js']
  },
  'safari': {
    description: 'Test específico para problemas de Safari móvil',
    projects: ['Mobile Safari iPhone', 'Mobile Safari iPhone Pro', 'Desktop Safari'],
    tests: ['tests/iteration-callback.test.js', 'tests/callback-qa.test.js']
  }
};

function printHelp() {
  console.log(`
🧪 LUCI QA Testing Tool - Callback & Iterations

Uso: node scripts/run-qa.js [modo] [opciones]

Modos disponibles:
${Object.entries(QA_MODES).map(([key, mode]) => 
  `  ${key.padEnd(12)} - ${mode.description}`
).join('\n')}

Opciones:
  --headed     Ejecutar con navegador visible
  --debug      Ejecutar con debug activado  
  --report     Generar reporte detallado
  --parallel   Ejecutar tests en paralelo (más rápido)
  --help       Mostrar esta ayuda

Ejemplos:
  node scripts/run-qa.js quick
  node scripts/run-qa.js iterations --headed
  node scripts/run-qa.js full --report
  node scripts/run-qa.js safari --debug --headed
  node scripts/run-qa.js monitoring --report

🎯 Específico para iteraciones:
  node scripts/run-qa.js iterations  # Test las iteraciones 2-3 problemáticas
`);
}
}

function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    printHelp();
    process.exit(0);
  }
  
  const mode = args[0];
  if (!QA_MODES[mode]) {
    console.error(`❌ Modo '${mode}' no válido. Modos disponibles: ${Object.keys(QA_MODES).join(', ')}`);
    process.exit(1);
  }
  
  return {
    mode,
    headed: args.includes('--headed'),
    debug: args.includes('--debug'),
    report: args.includes('--report'),
    parallel: args.includes('--parallel')
  };
}

function buildPlaywrightCommand(config) {
  const { mode, headed, debug, report, parallel } = config;
  const modeConfig = QA_MODES[mode];
  
  let cmd = ['npx', 'playwright', 'test'];
  
  // Agregar tests específicos
  if (modeConfig.tests) {
    cmd.push(...modeConfig.tests);
  }
  
  // Agregar proyectos específicos
  if (modeConfig.projects) {
    modeConfig.projects.forEach(project => {
      cmd.push('--project', project);
    });
  }
  
  // Opciones adicionales
  if (headed) cmd.push('--headed');
  if (debug) cmd.push('--debug');
  if (!parallel) cmd.push('--workers', '1');
  
  // Configuración de reportes
  cmd.push('--reporter', 'html,json,allure-playwright');
  
  return cmd;
}

function ensureDirectories() {
  const dirs = [
    'test-results',
    'playwright-report', 
    'allure-results',
    'qa-reports'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

async function generateCustomReport() {
  console.log('\n📊 Generando reporte personalizado...');
  
  try {
    // Leer resultados JSON
    const resultsPath = 'test-results/results.json';
    if (!fs.existsSync(resultsPath)) {
      console.log('⚠️ No se encontraron resultados JSON');
      return;
    }
    
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    
    // Generar reporte personalizado
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.suites.reduce((sum, suite) => sum + suite.specs.length, 0),
        passed: results.suites.reduce((sum, suite) => 
          sum + suite.specs.filter(spec => spec.tests.every(test => test.status === 'passed')).length, 0),
        failed: results.suites.reduce((sum, suite) => 
          sum + suite.specs.filter(spec => spec.tests.some(test => test.status === 'failed')).length, 0),
        duration: results.duration
      },
      deviceResults: {},
      errors: []
    };
    
    // Agrupar por dispositivo/navegador
    results.suites.forEach(suite => {
      suite.specs.forEach(spec => {
        spec.tests.forEach(test => {
          const projectName = test.projectName || 'Unknown';
          
          if (!report.deviceResults[projectName]) {
            report.deviceResults[projectName] = {
              total: 0,
              passed: 0,
              failed: 0,
              errors: []
            };
          }
          
          report.deviceResults[projectName].total++;
          
          if (test.status === 'passed') {
            report.deviceResults[projectName].passed++;
          } else if (test.status === 'failed') {
            report.deviceResults[projectName].failed++;
            report.deviceResults[projectName].errors.push({
              test: spec.title,
              error: test.error?.message || 'Unknown error'
            });
          }
        });
      });
    });
    
    // Guardar reporte
    const reportPath = `qa-reports/qa-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Mostrar resumen en consola
    console.log('\n📋 RESUMEN DE QA:');
    console.log(`✅ Tests pasados: ${report.summary.passed}`);
    console.log(`❌ Tests fallados: ${report.summary.failed}`);
    console.log(`⏱️ Duración total: ${(report.summary.duration / 1000 / 60).toFixed(2)} minutos`);
    
    console.log('\n🔍 RESULTADOS POR DISPOSITIVO:');
    Object.entries(report.deviceResults).forEach(([device, results]) => {
      const successRate = (results.passed / results.total * 100).toFixed(1);
      console.log(`  ${device}: ${results.passed}/${results.total} (${successRate}%)`);
      
      if (results.errors.length > 0) {
        console.log(`    ❌ Errores: ${results.errors.length}`);
        results.errors.forEach(error => {
          console.log(`      - ${error.test}: ${error.error}`);
        });
      }
    });
    
    console.log(`\n📁 Reporte guardado en: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Error generando reporte:', error.message);
  }
}

async function main() {
  const config = parseArgs();
  
  console.log(`🚀 Iniciando QA Testing en modo: ${config.mode}`);
  console.log(`📝 ${QA_MODES[config.mode].description}`);
  
  ensureDirectories();
  
  const cmd = buildPlaywrightCommand(config);
  console.log(`\n💻 Ejecutando: ${cmd.join(' ')}`);
  
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const process = spawn(cmd[0], cmd.slice(1), {
      stdio: 'inherit',
      shell: true
    });
    
    process.on('close', async (code) => {
      const duration = Date.now() - startTime;
      console.log(`\n⏱️ Tiempo total: ${(duration / 1000 / 60).toFixed(2)} minutos`);
      
      if (code === 0) {
        console.log('✅ Todos los tests completados exitosamente');
        
        if (config.report) {
          await generateCustomReport();
        }
        
        console.log('\n📊 Para ver el reporte HTML: npx playwright show-report');
        resolve();
      } else {
        console.log(`❌ Tests fallaron con código: ${code}`);
        
        if (config.report) {
          await generateCustomReport();
        }
        
        reject(new Error(`Tests failed with code ${code}`));
      }
    });
    
    process.on('error', (error) => {
      console.error('❌ Error ejecutando tests:', error.message);
      reject(error);
    });
  });
}

// Manejar Ctrl+C
process.on('SIGINT', () => {
  console.log('\n⚠️ Tests interrumpidos por el usuario');
  process.exit(130);
});

main().catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});
