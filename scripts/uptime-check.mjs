#!/usr/bin/env node

/**
 * uptime-check.mjs
 * Pings prooflabs.net and alerts if down
 */

const SITE_URL = 'https://prooflabs.net';
const TIMEOUT_MS = 10000;

async function checkUptime() {
  const startTime = Date.now();
  
  try {
    const response = await fetch(SITE_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      console.log(`✅ Site UP - ${response.status} - ${responseTime}ms`);
      return { status: 'up', code: response.status, time: responseTime };
    } else {
      console.error(`⚠️ Site returned ${response.status} - ${responseTime}ms`);
      return { status: 'degraded', code: response.status, time: responseTime };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`🔴 Site DOWN - ${error.message} - ${responseTime}ms`);
    return { status: 'down', error: error.message, time: responseTime };
  }
}

const result = await checkUptime();
process.exit(result.status === 'down' ? 1 : 0);
