#!/usr/bin/env node
/**
 * Link Audit Script
 * Crawls all HTML files in dist/ and checks for broken internal links
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');
const SITE_URL = 'https://prooflabs.net';

// Get all HTML files recursively
function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Extract internal links from HTML
function extractInternalLinks(htmlContent, sourcePath) {
  const dom = new JSDOM(htmlContent);
  const links = [];
  const anchors = dom.window.document.querySelectorAll('a[href]');
  
  anchors.forEach(anchor => {
    const href = anchor.getAttribute('href');
    
    // Check if it's an internal link
    if (href.startsWith('/') || href.startsWith(SITE_URL)) {
      // Normalize the URL
      let normalizedHref = href;
      if (href.startsWith(SITE_URL)) {
        normalizedHref = href.replace(SITE_URL, '');
      }
      
      // Skip anchors (#) and mailto/tel
      if (!normalizedHref.startsWith('#') && 
          !normalizedHref.startsWith('mailto:') && 
          !normalizedHref.startsWith('tel:')) {
        links.push(normalizedHref);
      }
    }
  });
  
  return links;
}

// Check if a link target exists in the build
function linkExists(link, distDir) {
  // Remove query strings and fragments
  let cleanLink = link.split('?')[0].split('#')[0];
  
  // Normalize trailing slashes
  if (cleanLink.endsWith('/')) {
    cleanLink = cleanLink.slice(0, -1);
  }
  
  // Try different path variations
  const possiblePaths = [
    path.join(distDir, `${cleanLink}.html`),
    path.join(distDir, cleanLink, 'index.html'),
    path.join(distDir, `${cleanLink}/index.html`)
  ];
  
  // If the link is just '/', check for index.html
  if (cleanLink === '' || cleanLink === '/') {
    possiblePaths.push(path.join(distDir, 'index.html'));
  }
  
  return possiblePaths.some(p => fs.existsSync(p));
}

// Main audit function
function auditLinks() {
  console.log('🔍 Starting link audit...\n');
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Error: dist/ directory not found. Run `npm run build` first.');
    process.exit(1);
  }
  
  const htmlFiles = getAllHtmlFiles(DIST_DIR);
  console.log(`📄 Found ${htmlFiles.length} HTML files\n`);
  
  const brokenLinks = [];
  let totalLinksChecked = 0;
  
  htmlFiles.forEach(filePath => {
    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(DIST_DIR, filePath);
    const links = extractInternalLinks(htmlContent, filePath);
    
    links.forEach(link => {
      totalLinksChecked++;
      
      if (!linkExists(link, DIST_DIR)) {
        brokenLinks.push({
          source: relativePath,
          target: link
        });
      }
    });
  });
  
  console.log(`✅ Checked ${totalLinksChecked} internal links\n`);
  
  if (brokenLinks.length === 0) {
    console.log('🎉 No broken links found!\n');
    return true;
  } else {
    console.log(`❌ Found ${brokenLinks.length} broken link(s):\n`);
    
    brokenLinks.forEach(({ source, target }) => {
      console.log(`  ${source}`);
      console.log(`    ↳ ${target}\n`);
    });
    
    return false;
  }
}

// Run the audit
const success = auditLinks();
process.exit(success ? 0 : 1);
